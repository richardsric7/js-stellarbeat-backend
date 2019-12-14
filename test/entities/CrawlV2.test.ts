import CrawlV2 from "../../src/entities/CrawlV2";

test("crawlV2", () => {
    let date = new Date();
    let crawl = new CrawlV2(date, [1]);

    expect(crawl.ledgers).toEqual([1]);
    expect(crawl.validFrom).toEqual(date);
    expect(crawl.validTo).toEqual(CrawlV2.MAX_DATE);
} );