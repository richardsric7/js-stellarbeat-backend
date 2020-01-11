import {EntityRepository, Repository} from "typeorm";
import NodeMeasurementDayV2 from "../entities/NodeMeasurementDayV2";
import NodePublicKeyStorage from "../entities/NodePublicKeyStorage";
import {NodeMeasurementV2AverageRecord, NodeMeasurementV2Average} from "./NodeMeasurementV2Repository";

export interface IMeasurementRollupRepository {
    findBetween(nodePublicKeyStorage: NodePublicKeyStorage, from: Date, to: Date): Promise<any[]>;
    rollup(fromCrawlId: number, toCrawlId: number): void;
}

@EntityRepository(NodeMeasurementDayV2)
export class NodeMeasurementDayV2Repository extends Repository<NodeMeasurementDayV2> implements IMeasurementRollupRepository{

    async findXDaysAverageAt(at: Date, xDays: number):Promise<NodeMeasurementV2Average[]> {
        let from = new Date(at.getTime());
        from.setDate(at.getDate() - xDays);

        let result = await this.query(
            'select "nodePublicKeyStorageId" as "nodePublicKeyStorageId",\n' +
            '       ROUND(100.0 * (sum("isActiveCount"::int::decimal) / sum("crawlCount")), 2)        as "activeDayAvg",\n' +
            '       ROUND(100.0 * (sum("isValidatingCount"::int::decimal) / sum("crawlCount")), 2)    as "validatingDayAvg",\n' +
            '       ROUND(100.0 * (sum("isFullValidatorCount"::int::decimal) / sum("crawlCount")), 2) as "fullValidatorDayAvg",\n' +
            '       ROUND(100.0 * (sum("isOverloadedCount"::int::decimal) / sum("crawlCount")), 2)    as "overLoadedDayAvg",\n' +
            '       ROUND((sum("indexSum"::int::decimal ) / sum("crawlCount")),2)             as "indexAvg"' +
            'FROM "node_measurement_day_v2" "NodeMeasurementDay"\n' +
            'WHERE day >= date_trunc(\'day\', $1::TIMESTAMP)\n' + //todo: date trunc to nodejs side?
            '  and day <= date_trunc(\'day\', $2::TIMESTAMP)\n' +
            'GROUP BY "nodePublicKeyStorageId"\n' +
            'having count("nodePublicKeyStorageId") >= $3', //needs a record every day in the range, or the average is NA
            [from, at, xDays]
        );

        return result.map((record:NodeMeasurementV2AverageRecord) => NodeMeasurementV2Average.fromDatabaseRecord(record));
    }

    async findBetween(nodePublicKeyStorage: NodePublicKeyStorage, from: Date, to: Date) {
        return this.query('with measurements as (\n' +
            '    SELECT "NodeMeasurementDay"."day",\n' +
            '           "NodeMeasurementDay"."isValidatingCount",\n' +
            '           "NodeMeasurementDay"."crawlCount"\n' +
            '    FROM "node_measurement_day_v2" "NodeMeasurementDay"\n' +
            '    WHERE "nodePublicKeyStorageId" = $1\n' +
            '      AND "day" >= date_trunc(\'day\', $2::timestamp)\n' +
            '      and "day" <= date_trunc(\'day\', $3::timestamp)\n' +
            ') select d.day, $1 "publicKey", coalesce("isValidatingCount", 0) "isValidatingCount", coalesce("crawlCount",0) "crawlCount"\n' +
            'from (select generate_series( date_trunc(\'day\', $2::TIMESTAMP), date_trunc(\'day\', $3::TIMESTAMP), interval \'1 day\')) d(day)\n' +
            '        LEFT OUTER JOIN measurements on d.day = measurements.day\n',
            [nodePublicKeyStorage.id, from, to]);
    }

    async findXDaysInactive(since: Date, numberOfDays: number):Promise<{nodePublicKeyStorageId: number}[]>{
        return this.createQueryBuilder().distinct(true)
            .select('"nodePublicKeyStorageId"')
            .where('day >= :since::timestamptz - :numberOfDays * interval \'1 days\'', {since: since, numberOfDays: numberOfDays})
            .having('sum("isActiveCount") = 0')
            .groupBy('"nodePublicKeyStorageId", day >= :since::timestamptz - :numberOfDays * interval \'1 days\'')
            .getRawMany();
    }

    async rollup(fromCrawlId: number, toCrawlId: number) {
        await this.query("INSERT INTO node_measurement_day_v2 (day, \"nodePublicKeyStorageId\", \"isActiveCount\", \"isValidatingCount\", \"isFullValidatorCount\", \"isOverloadedCount\", \"indexSum\", \"crawlCount\")\n" +
            "    with crawls as (\n" +
            "        select date_trunc('day', \"Crawl\".\"validFrom\") \"crawlDay\", count(distinct \"Crawl2\".id) \"crawlCount\"\n" +
            "        from  crawl_v2 \"Crawl\"\n" +
            "        join crawl_v2 \"Crawl2\" on date_trunc('day', \"Crawl\".\"validFrom\") = date_trunc('day', \"Crawl2\".\"validFrom\") AND \"Crawl2\".completed = true\n" +
            "        WHERE \"Crawl\".id BETWEEN " + fromCrawlId + " AND " + toCrawlId + " and \"Crawl\".completed = true\n" +
            "        group by \"crawlDay\"\n" +
            "    )\n" +
            "select date_trunc('day', \"validFrom\") \"day\",\n" +
            "       \"nodePublicKeyStorageId\",\n" +
            "       sum(\"isActive\"::int) \"isActiveCount\",\n" +
            "       sum(\"isValidating\"::int) \"isValidatingCount\",\n" +
            "       sum(\"isFullValidator\"::int) \"isFullValidatorCount\",\n" +
            "       sum(\"isOverLoaded\"::int) \"isOverloadedCount\",\n" +
            "       sum(\"index\"::int) \"indexSum\",\n" +
            "       \"crawls\".\"crawlCount\" \"crawlCount\"\n" +
            '    FROM "crawl_v2" "CrawlV2"' +
            "             join crawls on crawls.\"crawlDay\" = date_trunc('day', \"CrawlV2\".\"validFrom\")\n" +
            "join node_measurement_v2 on node_measurement_v2.\"time\" = \"CrawlV2\".\"validFrom\"\n" +
            "    WHERE \"CrawlV2\".id BETWEEN $1 AND $2 AND \"CrawlV2\".completed = true\n" +
            "group by day, \"nodePublicKeyStorageId\", \"crawlCount\"\n" +
            "ON CONFLICT (day, \"nodePublicKeyStorageId\") DO UPDATE\n" +
            "SET\n" +
            "    \"isActiveCount\" = node_measurement_day_v2.\"isActiveCount\" + EXCLUDED.\"isActiveCount\",\n" +
            "    \"isValidatingCount\" = node_measurement_day_v2.\"isValidatingCount\" + EXCLUDED.\"isValidatingCount\",\n" +
            "    \"isFullValidatorCount\" = node_measurement_day_v2.\"isFullValidatorCount\" + EXCLUDED.\"isFullValidatorCount\",\n" +
            "    \"isOverloadedCount\" = node_measurement_day_v2.\"isOverloadedCount\" + EXCLUDED.\"isOverloadedCount\",\n" +
            "    \"indexSum\" = node_measurement_day_v2.\"indexSum\" + EXCLUDED.\"indexSum\",\n" +
            "    \"crawlCount\" = EXCLUDED.\"crawlCount\"",
            [fromCrawlId, toCrawlId]);
    }
}