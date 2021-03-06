import * as AWS from "aws-sdk";
require('dotenv').config();
//import {Node} from "@stellarbeat/js-stellar-domain";
import * as path from "path";
import Kernel from "../Kernel";
import {CrawlResultProcessor} from "../services/CrawlResultProcessor";
import CrawlV2 from "../entities/CrawlV2";
import {Node} from "@stellarbeat/js-stellar-domain";
import {Connection} from "typeorm";

// noinspection JSIgnoredPromiseFromCall
main();

async function main() {

    if (process.argv.length <= 2) {
        console.log("Usage: " + __filename + " PATH_PREFIX");

        process.exit(-1);
    }
    let pathPrefix = process.argv[2];
    await getNodeFilesFromS3(pathPrefix);
}

async function getNodeFilesFromS3(pathPrefix: string): Promise<void> {
    let accessKeyId = process.env.AWS_ACCESS_KEY;
    let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    let bucketName = process.env.AWS_BUCKET_NAME;
    let environment = process.env.NODE_ENV;
    if (!accessKeyId || !secretAccessKey || !bucketName || !accessKeyId || !environment) {
        console.log("s3 not configured");
        return;
    }

    let s3 = new AWS.S3({
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    });

    let files = await listAllKeys(s3, bucketName, pathPrefix);

    let kernel = new Kernel();
    await kernel.initializeContainer();
    let crawlResultProcessor = kernel.container.get(CrawlResultProcessor);

    for(let file of files) {
        try {
            console.log("importing file: " + file.Key);
            let crawlDateString = path.basename(file.Key, '.json');
            let nodeStrings:AWS.S3.Types.GetObjectOutput = await s3.getObject({
                Bucket: bucketName,
                Key: file.Key
            }).promise();
            if(!(nodeStrings.Body instanceof Uint8Array && nodeStrings.LastModified !== undefined)) {
                console.log("wrong output from s3 file, skipping file: " + file.Key);
                continue;
            }
            let nodeObjects = JSON.parse(new Buffer(nodeStrings.Body).toString("utf8"));
            let nodes:Node[] = nodeObjects.map((node:any):Node => {
                return Node.fromJSON(node);
            });
            let alreadyCrawl = false; //todo
            if(alreadyCrawl !== undefined) {
                console.log(alreadyCrawl);
                console.log('already processed crawl: ' + crawlDateString);
                continue;
            }

            let crawlV2 = new CrawlV2(new Date(crawlDateString));
            await crawlResultProcessor.processCrawl(crawlV2, nodes, []);



        } catch (e) {
            console.log(e);
        }
    }

    await kernel.container.get(Connection).close();
}

async function listAllKeys(s3: AWS.S3, bucketName: string, pathPrefix: string, token: string | null = null, previousKeys: string[] = []): Promise<any[]> {
    var opts = {Bucket: bucketName, Prefix: pathPrefix} as any;

    if (token !== null) {
        opts.ContinuationToken = token;
    }

    let data:AWS.S3.Types.ListObjectsV2Output = await s3.listObjectsV2(opts).promise();
    let allKeys = previousKeys.concat(data.Contents as any);

    if (data.IsTruncated) {
        return await listAllKeys(s3, bucketName, pathPrefix, data.NextContinuationToken, allKeys);
    }


    return allKeys;
}