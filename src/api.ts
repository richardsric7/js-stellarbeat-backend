import OrganizationMeasurementService from "./services/OrganizationMeasurementService";

require('dotenv').config();

//import * as swaggerUiExpress from 'swagger-ui-express';
import * as express from 'express';
import CrawlV2Service from "./services/CrawlV2Service";

import Kernel from "./Kernel";
import {isDateString} from "./validation/isDateString";
import NodeMeasurementService from "./services/NodeMeasurementService";
import NodeSnapShotter from "./services/SnapShotting/NodeSnapShotter";
import {Network} from "@stellarbeat/js-stellar-domain";
import OrganizationSnapShotter from "./services/SnapShotting/OrganizationSnapShotter";
import {NetworkMeasurementMonthRepository} from "./repositories/NetworkMeasurementMonthRepository";
import {NetworkMeasurementDayRepository} from "./repositories/NetworkMeasurementDayRepository";
import {NetworkMeasurementRepository} from "./repositories/NetworkMeasurementRepository";
import {Between} from "typeorm";

//const swaggerDocument = require('../swagger/swagger.json');
const api = express();

const listen = async () => {
    let kernel = new Kernel();
    await kernel.initializeContainer();
    let crawlV2Service = kernel.container.get(CrawlV2Service);
    let nodeMeasurementService = kernel.container.get(NodeMeasurementService);
    let organizationMeasurementService = kernel.container.get(OrganizationMeasurementService);
    let nodeSnapShotter = kernel.container.get(NodeSnapShotter);
    let organizationSnapShotter = kernel.container.get(OrganizationSnapShotter);
    let latestCrawl = await crawlV2Service.getCrawlAt(new Date());
    let latestNetwork:Network;
    if(latestCrawl){
        latestNetwork = new Network(latestCrawl.nodes, latestCrawl.organizations, latestCrawl.time, latestCrawl.statistics);
    }

    let port = process.env.PORT || 3000;
    let backendApiClearCacheToken = process.env.BACKEND_API_CACHE_TOKEN;
    if (!backendApiClearCacheToken)
        throw "Error: api token not configured";

    api.use(function (req: express.Request, res: express.Response, next: express.NextFunction) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    api.use(function (req, res, next) {
        if (req.url.match(/^\/$/)
        ) {
            res.redirect(301, '/v1/network/stellar-public');
        }
        next();
    });

//    api.use('/docs', swaggerUiExpress.serve, swaggerUiExpress.setup(swaggerDocument));

    api.get('/v1/nodes', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.nodes);
        else res.status(500).send('Internal Server Error: no crawl data');
    });

    api.get('/v1/nodes/:publicKey', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.nodes.find(node => node.publicKey === req.params.publicKey));
        else res.status(500).send('Internal Server Error: no crawl data');
    });

    api.get('/v1/organizations', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.organizations)
        else res.status(500).send('Internal Server Error: no crawl data');
    });
    api.get('/v1/organizations/:id', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.organizations.find(organization => organization.id === req.params.id));
        else res.status(500).send('Internal Server Error: no crawl data');
    });

    api.get('/v1/network/stellar-public/node', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.nodes);
        else res.status(500).send('Internal Server Error: no crawl data');
    });

    api.get('/v1/network/stellar-public/node/:publicKey', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.nodes.find(node => node.publicKey === req.params.publicKey));
        else res.status(500).send('Internal Server Error: no crawl data');
    });

    api.get('/v1/network/stellar-public/node/:publicKey/snapshots', async (req: express.Request, res: express.Response) => {
        let at = req.query.at;
        let time: Date;
        if (!(at && isDateString(at))){
            time = new Date();
        } else {
            time = new Date(at);
        }
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        res.send(await nodeSnapShotter.findLatestSnapShotsByNode(req.params.publicKey, time));
    });

    api.get('/v1/network/stellar-public/node/:publicKey/day-statistics', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header

        let to = req.query.to;
        let from = req.query.from;

        if(!isDateString(to) || !isDateString(from)){
            res.status(400);
            res.send("invalid to or from parameters");
            return;
        }

        let stats = await nodeMeasurementService.getNodeDayMeasurements(req.params.publicKey, new Date(from), new Date(to));
        res.send(stats);
    });

    api.get('/v1/network/stellar-public/node/:publicKey/statistics', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header

        let to = req.query.to;
        let from = req.query.from;

        if(!isDateString(to) || !isDateString(from)){
            res.status(400);
            res.send("invalid to or from parameters");
            return;
        }

        let stats = await nodeMeasurementService.getNodeMeasurements(req.params.publicKey, new Date(from), new Date(to));
        res.send(stats);
    });

    api.get('/v1/network/stellar-public/organization', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.organizations)
        else res.status(500).send('Internal Server Error: no crawl data');
    });
    api.get('/v1/network/stellar-public/organization/:id', (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        if(latestNetwork)
            res.send(latestNetwork.organizations.find(organization => organization.id === req.params.id));
        else res.status(500).send('Internal Server Error: no crawl data');
    });

    api.get('/v1/network/stellar-public/organization/:id/snapshots', async (req: express.Request, res: express.Response) => {
        let at = req.query.at;
        let time: Date;
        if (!(at && isDateString(at))){
            time = new Date();
        } else {
            time = new Date(at);
        }
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        res.send(await organizationSnapShotter.findLatestSnapShotsByOrganization(req.params.id, time));
    });

    api.get('/v1/network/stellar-public/organization/:id/day-statistics', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header

        let to = req.query.to;
        let from = req.query.from;

        if(!isDateString(to) || !isDateString(from)){
            res.status(400);
            res.send("invalid to or from parameters");
            return;
        }

        let stats = await organizationMeasurementService.getOrganizationDayMeasurements(req.params.id, new Date(from), new Date(to));
        res.send(stats);
    });

    api.get('/v1/network/stellar-public/organization/:id/statistics', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header

        let to = req.query.to;
        let from = req.query.from;

        if(!isDateString(to) || !isDateString(from)){
            res.status(400);
            res.send("invalid to or from parameters");
            return;
        }

        let stats = await organizationMeasurementService.getOrganizationMeasurements(req.params.id, new Date(from), new Date(to));
        res.send(stats);
    });

    api.get('/v1/network/stellar-public', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 60); // cache for 60 seconds
        let at = req.query.at;
        let time: Date;
        if (!(at && isDateString(at))){
            if(latestNetwork)
                res.send(latestNetwork);
            else res.status(500).send('Internal Server Error: no crawl data');
            return;
        }

        time = new Date(at);

        let crawl = await crawlV2Service.getCrawlAt(time);
        if(!crawl){
            res.send(404);
            return;
        }
        let network = new Network(crawl.nodes, crawl.organizations, crawl.time, crawl.statistics);
        if(!network) // && latestCrawl.statistics after migration
            res.status(500).send('Internal Server Error: no crawl data');
        else
            res.send(network);
    });

    api.get('/v1/network/stellar-public/month-statistics', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header

        let to = req.query.to;
        let from = req.query.from;

        if(!isDateString(to) || !isDateString(from)){
            res.status(400);
            res.send("invalid to or from parameters")
            return;
        }

        let stats = await kernel.container.get(NetworkMeasurementMonthRepository).findBetween(new Date(from), new Date(to));
        res.send(stats);
    });

    api.get('/v1/network/stellar-public/day-statistics', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header

        let to = req.query.to;
        let from = req.query.from;

        if(!isDateString(to) || !isDateString(from)){
            res.status(400);
            res.send("invalid to or from parameters")
            return;
        }

        let stats = await kernel.container.get(NetworkMeasurementDayRepository).findBetween(new Date(from), new Date(to));
        res.send(stats);
    });

    api.get('/v1/network/stellar-public/statistics', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header

        let to = req.query.to;
        let from = req.query.from;

        if(!isDateString(to) || !isDateString(from)){
            res.status(400);
            res.send("invalid to or from parameters")
            return;
        }

        let stats = await kernel.container.get(NetworkMeasurementRepository).find({
            where: [{
                time: Between(new Date(from), new Date(to))
            }]
        })

        res.send(stats);
    });

    api.get('/v1/network/stellar-public/node-snapshots', async (req: express.Request, res: express.Response) => {
        let at = req.query.at;
        let time: Date;
        if (!(at && isDateString(at))){
            time = new Date();
        } else {
            time = new Date(at);
        }
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        res.send(await nodeSnapShotter.findLatestSnapShots(time));
    });

    api.get('/v1/network/stellar-public/organization-snapshots', async (req: express.Request, res: express.Response) => {
        let at = req.query.at;
        let time: Date;
        if (!(at && isDateString(at))){
            time = new Date();
        } else {
            time = new Date(at);
        }
        res.setHeader('Cache-Control', 'public, max-age=' + 30); // cache header
        res.send(await organizationSnapShotter.findLatestSnapShots(time));
    });

    //@deprecated
    api.get('/v2/all', async (req: express.Request, res: express.Response) => {
        res.setHeader('Cache-Control', 'public, max-age=' + 60); // cache for 60 seconds
        let at = req.query.at;
        let time: Date;
        if (!(at && isDateString(at))){
            res.send(latestCrawl);
            return;
        }

        time = new Date(at);
        let crawl = await crawlV2Service.getCrawlAt(time);

        res.send(crawl);
    });

    api.get('/v1/clear-cache', async (req: express.Request, res: express.Response) => {
        if (req.param("token") !== backendApiClearCacheToken) {
            res.send("invalid token");
            return;
        }

        latestCrawl = await crawlV2Service.getCrawlAt(new Date());
        if(latestCrawl){
            latestNetwork = new Network(latestCrawl.nodes, latestCrawl.organizations, latestCrawl.time, latestCrawl.statistics);
        }
        res.send("cache cleared!");
    });

    api.listen(port, () => console.log('api listening on port: ' + port));
};

listen();