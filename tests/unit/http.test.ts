import { describe, expect, it, vi } from "vitest";
import { invalid, notFound, unauthorized, unavailable } from "@/server/errors";
import { handle, parseId, readJson } from "@/server/http";
import { CreateTenderBody } from "@/shared/tender-body";

vi.mock("@/server/report-error", () => ({ reportError: vi.fn() }));

interface ErrorBody {
  error: { message: string };
}

interface StatusAndBody {
  status: number;
  body: ErrorBody;
}

async function statusAndBody(response: Response): Promise<StatusAndBody> {
  return { status: response.status, body: (await response.json()) as ErrorBody };
}

function jsonRequest(body: string): Request {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("http handle", () => {
  it("answers 401 when the work throws unauthorized", async () => {
    const result = await statusAndBody(await handle(() => Promise.reject(unauthorized())));
    expect(result).toEqual({ status: 401, body: { error: { message: "Sign in first." } } });
  });

  it("answers 404 with the message when the work throws notFound", async () => {
    const result = await statusAndBody(
      await handle(() => Promise.reject(notFound("Tender not found."))),
    );
    expect(result).toEqual({ status: 404, body: { error: { message: "Tender not found." } } });
  });

  it("answers 400 when the work throws invalid", async () => {
    const result = await statusAndBody(await handle(() => Promise.reject(invalid("Bad name."))));
    expect(result).toEqual({ status: 400, body: { error: { message: "Bad name." } } });
  });

  it("answers 500 with the app message when the work throws unavailable", async () => {
    const result = await statusAndBody(
      await handle(() => Promise.reject(unavailable("Try later.", new Error("db down")))),
    );
    expect(result).toEqual({ status: 500, body: { error: { message: "Try later." } } });
  });

  it("hides the real message and stack when the work throws an unknown error", async () => {
    const response = await handle(() =>
      Promise.reject(new Error('relation "tender" does not exist at postgres://u:p@h/x')),
    );
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: { message: "Something went wrong. Please try again." },
    });
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("stack");
  });

  it("passes the response through when the work succeeds", async () => {
    const response = await handle(() => Promise.resolve(Response.json({ ok: true })));
    expect(response.status).toBe(200);
  });
});

describe("http readJson", () => {
  it("returns the parsed body when it matches the schema", async () => {
    await expect(readJson(jsonRequest('{"name":"Road"}'), CreateTenderBody)).resolves.toEqual({
      name: "Road",
    });
  });

  it("throws invalid when the body isn't JSON", async () => {
    await expect(readJson(jsonRequest("not json"), CreateTenderBody)).rejects.toMatchObject({
      kind: "invalid",
    });
  });

  it("throws invalid when the body has the wrong shape", async () => {
    await expect(readJson(jsonRequest('{"name":5}'), CreateTenderBody)).rejects.toMatchObject({
      kind: "invalid",
    });
  });
});

describe("http parseId", () => {
  it("returns the id when it is a uuid", () => {
    const id = "3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f";
    expect(parseId(id, "Tender not found.")).toBe(id);
  });

  it("throws notFound when the id isn't a uuid", () => {
    const bad = ["", "nope", "1", "../etc/passwd", "3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f'"];
    for (const id of bad) {
      expect(() => parseId(id, "Tender not found.")).toThrow(
        expect.objectContaining({ kind: "not_found", message: "Tender not found." }),
      );
    }
  });
});
