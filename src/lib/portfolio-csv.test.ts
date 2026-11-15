import { describe, expect, it } from "vitest";

import {
  MAX_IMPORT_ROWS,
  normalizeTicker,
  parseAmount,
  parsePortfolioCsv,
  splitCsv,
} from "./portfolio-csv";

describe("portfolio CSV import", () => {
  it("reads a simple ticker, shares and average price file", () => {
    const r = parsePortfolioCsv("Ticker,Shares,Avg Price\nnvda,10,120.5\nCRWD,3,\n");
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([
      { ticker: "NVDA", shares: 10, avgPrice: 120.5 },
      { ticker: "CRWD", shares: 3, avgPrice: null },
    ]);
  });

  it("finds the header after brokerage preamble lines and skips footer text", () => {
    const csv = [
      "Brokerage Account X12345",
      "",
      '"Account Number","Symbol","Description","Quantity","Last Price","Average Cost Basis"',
      '"X12345","NVDA","NVIDIA CORP","1,200","$140.00","$98.10"',
      '"X12345","SPAXX**","HELD IN MONEY MARKET","","",""',
      '"X12345","Pending Activity","","","",""',
      '"The data and information in this spreadsheet is provided to you solely for your use."',
    ].join("\r\n");
    const r = parsePortfolioCsv(csv);
    expect(r.rows).toEqual([
      { ticker: "NVDA", shares: 1200, avgPrice: 98.1 },
      { ticker: "SPAXX", shares: null, avgPrice: null },
    ]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["No valid ticker", "No valid ticker"]);
  });

  it("derives a per-share cost from a total cost basis column", () => {
    const r = parsePortfolioCsv("Symbol,Qty (Quantity),Cost Basis\nINTC,40,$1000.00\n");
    expect(r.rows).toEqual([{ ticker: "INTC", shares: 40, avgPrice: 25 }]);
  });

  it("falls back to total cost when a row's per-share cost is blank", () => {
    const csv =
      'Symbol,Quantity,Cost Basis Total,Average Cost Basis\nTSLA,1000,"$250,000.00",\nAAPL,2,$300,$140\n';
    expect(parsePortfolioCsv(csv).rows).toEqual([
      { ticker: "TSLA", shares: 1000, avgPrice: 250 },
      { ticker: "AAPL", shares: 2, avgPrice: 140 },
    ]);
  });

  it("merges a ticker held in several accounts with a share-weighted average cost", () => {
    const r = parsePortfolioCsv("Symbol,Quantity,Average Cost\nTSLA,10,100\nTSLA,30,200\n");
    expect(r.rows).toEqual([{ ticker: "TSLA", shares: 40, avgPrice: 175 }]);
  });

  it("drops the merged position when one account lacks shares", () => {
    const r = parsePortfolioCsv("Symbol,Quantity,Average Cost\nTSLA,10,100\nTSLA,,\n");
    expect(r.rows).toEqual([{ ticker: "TSLA", shares: null, avgPrice: null }]);
  });

  it("reads headerless files positionally and semicolon or tab delimiters", () => {
    expect(parsePortfolioCsv("AAPL,5,150\nMSFT\n").rows).toEqual([
      { ticker: "AAPL", shares: 5, avgPrice: 150 },
      { ticker: "MSFT", shares: null, avgPrice: null },
    ]);
    expect(parsePortfolioCsv("Symbol;Shares\nAAPL;5\n").rows).toEqual([
      { ticker: "AAPL", shares: 5, avgPrice: null },
    ]);
    expect(parsePortfolioCsv("Symbol\tShares\nAAPL\t5\n").rows).toEqual([
      { ticker: "AAPL", shares: 5, avgPrice: null },
    ]);
  });

  it("explains files it cannot read", () => {
    expect(parsePortfolioCsv("").error).toBe("The file is empty.");
    expect(parsePortfolioCsv("Account summary for Jan\nBalance,100\n").error).toMatch(
      /Symbol or Ticker column/,
    );
    expect(parsePortfolioCsv("Symbol,Shares\nnot a ticker,5\n").error).toBe(
      "No rows with a valid ticker were found.",
    );
    const many = ["Symbol", ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `T${i}`)].join(
      "\n",
    );
    expect(parsePortfolioCsv(many).error).toMatch(/up to 100/);
  });

  it("parses amounts strictly instead of guessing", () => {
    expect(parseAmount("$1,234.50")).toBe(1234.5);
    expect(parseAmount("0.25")).toBe(0.25);
    expect(parseAmount("12,5")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("(3.00)")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });

  it("normalizes tickers and splits quoted cells", () => {
    expect(normalizeTicker(" brk.b ")).toBe("BRK.B");
    expect(normalizeTicker("FCASH**")).toBe("FCASH");
    expect(normalizeTicker("Pending Activity")).toBeNull();
    expect(splitCsv('a,"b,""c""",d\r\ne')).toEqual([["a", 'b,"c"', "d"], ["e"]]);
  });
});
