import assert from "node:assert/strict";
import test from "node:test";

import { shortNameFromName } from "@weeklyreport/shared";
import superjson from "superjson";

import { LEAD_FORM_FIXTURE } from "../setup/fixture-data.js";
import {
  HEAD_CLARITY,
  prepareHeadClarity,
} from "../setup/head-form-clarity.js";
import { loginAsHead } from "./access.js";
import {
  command,
  findRole,
  getAttr,
  getUrl,
  headSession,
  open,
  refsByRole,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import {
  oneRef,
  scopedRef,
  scopeSnapshot,
  waitButton,
  waitSnapshot,
} from "./helpers.js";

registerE2eHooks();

async function assertMutation(procedure: string, expected: object) {
  const session = headSession();
  await waitSnapshot(
    async () => {
      const { requests } = await command(["network", "requests"], session);
      assert(Array.isArray(requests));
      return requests.some((request: unknown) => {
        assert(typeof request === "object" && request !== null);
        if (
          !("url" in request) ||
          typeof request.url !== "string" ||
          !request.url.includes(procedure)
        )
          return false;
        if (
          !("method" in request) ||
          request.method !== "POST" ||
          !("postData" in request)
        )
          return false;
        assert(typeof request.postData === "string");
        const paths = decodeURIComponent(new URL(request.url).pathname)
          .split("/trpc/")[1]
          ?.split(",");
        assert(paths);
        const batch: unknown = JSON.parse(request.postData);
        assert(typeof batch === "object" && batch !== null);
        const key = String(paths.indexOf(procedure));
        assert(key in batch);
        const input = superjson.parse(JSON.stringify(Reflect.get(batch, key)));
        assert.partialDeepStrictEqual(input, expected);
        return true;
      });
    },
    `Expected acknowledged ${procedure} anchor`,
    session,
  );
}

async function assertReadOnly() {
  const data = await snapshot(headSession());
  assert.equal(refsByRole(data, "button", /^Approve /).length, 0);
  assert.equal(refsByRole(data, "textbox", /^Add a review comment/).length, 0);
}

test("Head queue Review preserves Activity anchors and one section verdict", async () => {
  const fixture = await prepareHeadClarity();
  const session = headSession();
  await loginAsHead(session);
  const href = `/head/report/${fixture.reportId}?authorId=${fixture.authorId}&scope=lead&review=1`;
  const queue = await waitSnapshot(
    async (data) => {
      for (const ref of refsByRole(
        data,
        "link",
        /^Review .* report section$/,
      )) {
        if ((await getAttr(ref, "href", session)) === href) return true;
      }
      return false;
    },
    "Expected the submitted Activity-only author's Review link",
    session,
  );
  const candidates = refsByRole(queue, "link", /^Review .* report section$/);
  const links = await Promise.all(
    candidates.map(async (ref) => ({
      ref,
      href: await getAttr(ref, "href", session),
    })),
  );
  const link = links.find((entry) => entry.href === href);
  assert(link);
  await command(["network", "requests", "--clear"], session);
  await command(["click", link.ref], session);
  await waitButton(`Approve ${fixture.authorName}`, { session });
  const regionId = `report-lead-${fixture.authorId}`;
  await command(
    [
      "wait",
      "--fn",
      `document.activeElement?.id === ${JSON.stringify(regionId)}`,
    ],
    session,
  );
  const region = scopeSnapshot(
    await snapshot(session),
    "region",
    shortNameFromName(fixture.authorName),
  );
  assert.equal(
    refsByRole(region, "button", `Approve ${fixture.authorName}`).length,
    1,
  );
  assert.equal(
    (await snapshot(session)).snapshot.includes(HEAD_CLARITY.draftRisk),
    false,
  );
  const disclosure = `${HEAD_CLARITY.activityName} details for ${fixture.authorName}`;
  const control = oneRef(await snapshot(session), "button", disclosure);
  assert.equal(await getAttr(control, "aria-expanded", session), "false");
  assert(await getAttr(control, "aria-controls", session));
  await command(["focus", control], session);
  await command(["press", "Enter"], session);
  await waitText(HEAD_CLARITY.risk, session);
  await findRole(
    "button",
    `Activity details unavailable details for ${fixture.authorName}`,
    "click",
    { session },
  );
  await waitText(HEAD_CLARITY.detachedRisk, session);
  const box = oneRef(
    await snapshot(session),
    "textbox",
    new RegExp(HEAD_CLARITY.risk),
  );
  await command(["fill", box, HEAD_CLARITY.comment], session);
  await command(
    [
      "click",
      await scopedRef(
        { role: "region", name: shortNameFromName(fixture.authorName) },
        "button",
        new RegExp(`^Comment on ${HEAD_CLARITY.risk}`),
        session,
      ),
    ],
    session,
  );
  await waitText(HEAD_CLARITY.comment, session);
  await assertMutation("review.comment", {
    riskId: fixture.riskId,
    text: HEAD_CLARITY.comment,
  });
  await findRole("button", `Approve ${fixture.authorName}`, "click", {
    session,
  });
  await assertMutation("review.verdict", {
    reportSectionId: fixture.sectionId,
    version: fixture.version,
    verdict: "approved",
  });
});

test("Head Read history, Slides, draft opt-in and period changes follow URL intent", async () => {
  const fixture = await prepareHeadClarity();
  const session = headSession();
  await loginAsHead(session);
  await open(
    `/head/report/${fixture.reportId}?authorId=${fixture.authorId}&scope=lead&review=1`,
    session,
  );
  await waitButton(`Approve ${fixture.authorName}`, { session });
  await findRole("button", "Read", "click", { session });
  await waitSnapshot(
    async () => !new URL(await getUrl(session)).searchParams.has("review"),
    "Read removes review intent",
    session,
  );
  await reload(session);
  await waitText("Portfolio report", session);
  await assertReadOnly();
  await open(
    `/head/report/${fixture.reportId}?authorId=${fixture.authorId}&scope=lead&review=1`,
    session,
  );
  await waitButton(`Approve ${fixture.authorName}`, { session });
  await command(["back"], session);
  await waitSnapshot(
    async () => !new URL(await getUrl(session)).searchParams.has("review"),
    "Read history entry",
    session,
  );
  await assertReadOnly();
  await command(["forward"], session);
  await waitButton(`Approve ${fixture.authorName}`, { session });
  await command(
    [
      "click",
      await scopedRef(
        { role: "group", name: "View mode" },
        "link",
        "Slides",
        session,
      ),
    ],
    session,
  );
  await waitSnapshot(
    async () =>
      new URL(await getUrl(session)).searchParams.get("mode") === "slides",
    "Slides navigation",
    session,
  );
  await waitText("Portfolio report", session);
  assert.equal(new URL(await getUrl(session)).searchParams.get("review"), "1");
  await assertReadOnly();
  await command(
    [
      "click",
      await scopedRef(
        { role: "group", name: "View mode" },
        "link",
        "Report",
        session,
      ),
    ],
    session,
  );
  await waitButton(`Approve ${fixture.authorName}`, { session });
  await findRole("button", "Show all sections including drafts", "click", {
    session,
  });
  const details = refsByRole(
    await snapshot(session),
    "button",
    /^Activity details unavailable details for /,
  );
  for (const ref of details)
    if ((await getAttr(ref, "aria-expanded", session)) === "false")
      await command(["click", ref], session);
  await waitText(HEAD_CLARITY.draftRisk, session);
  await findRole("button", "Previous period", "click", { session });
  await waitSnapshot(
    async () =>
      new URL(await getUrl(session)).pathname !==
      `/head/report/${fixture.reportId}`,
    "Period changed",
    session,
  );
  assert.equal(
    new URL(await getUrl(session)).searchParams.has("review"),
    false,
  );
  await assertReadOnly();
});

for (const reportId of [
  LEAD_FORM_FIXTURE.previousReportId,
  LEAD_FORM_FIXTURE.oldestArchiveReportId,
]) {
  test(`Head frozen ${reportId} rejects Review without mutation controls`, async () => {
    const session = headSession();
    await loginAsHead(session);
    await open(`/head/report/${reportId}?review=1`, session);
    await waitText("Review is unavailable for this report.", session);
    await waitText("Portfolio report", session);
    await assertReadOnly();
  });
}
