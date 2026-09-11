import { describe, expect, it } from "vitest";
import {
  getPreflightFailureMessage,
  getPublishFailureMessage,
  getPublishFailureContext,
  getPublishPresentation,
  isActivePublishStatus,
  type PublishJobSummary,
} from "../client/src/components/builder/publishStatus";

const job = (status: PublishJobSummary["status"]): PublishJobSummary => ({
  jobId: "publish-job-1",
  status,
  productionUrl: null,
  errorCode: null,
  failureDetails: null,
});

describe("publish status presentation", () => {
  it("keeps saving as temporary client state, separate from job stages", () => {
    expect(getPublishPresentation(null, true, null)).toMatchObject({
      stage: "saving",
      title: "Saving changes",
    });
    expect(getPublishPresentation(job("queued"), false, null)).toMatchObject({
      stage: "preparing",
      title: "Preparing your website",
    });
  });

  it("maps every durable publish stage to a customer-facing stage", () => {
    expect(getPublishPresentation(job("generating"), false, null).stage).toBe("preparing");
    expect(getPublishPresentation(job("uploading"), false, null).stage).toBe("uploading");
    expect(getPublishPresentation(job("deploying"), false, null).stage).toBe("building");
    expect(getPublishPresentation(job("waiting_for_alias"), false, null).stage).toBe("url");
    expect(getPublishPresentation(job("activating"), false, null).stage).toBe("url");
    expect(getPublishPresentation(job("published"), false, null).stage).toBe("published");
  });

  it("uses safe failure copy instead of a raw deployment error", () => {
    const failed = {
      ...job("failed"),
      errorMessage: "Vercel response: internal build trace",
      failureDetails: { stage: "deployment", pageName: "Contact" },
    };
    const presentation = getPublishPresentation(failed, false, null);

    expect(presentation.stage).toBe("failed");
    expect(presentation.description).toMatch(/Vercel could not build/i);
    expect(presentation.description).not.toContain("internal build trace");
    expect(getPublishFailureContext(failed)).toBe("Related page: Contact.");
  });

  it("explains when Vercel cannot prove deployment ownership", () => {
    const failed: PublishJobSummary = {
      ...job("failed"),
      jobId: "publish-job-project-mismatch",
      errorCode: "ACTIVATION_PROJECT_MISMATCH",
      failureDetails: { stage: "activation" },
    };

    expect(getPublishFailureMessage(failed)).toContain("belongs to this website");
    expect(getPublishFailureMessage(failed)).toContain("existing website was not changed");
  });

  it("has a useful fallback for unfamiliar status and error codes", () => {
    expect(getPublishPresentation(job("new_status"), false, null).description).toMatch(/unfamiliar status/i);
    expect(getPreflightFailureMessage({ code: "NEW_ERROR", status: 500 })).toMatch(/not sent to Vercel/i);
  });

  it("only considers real in-flight statuses active", () => {
    expect(isActivePublishStatus("queued")).toBe(true);
    expect(isActivePublishStatus("activating")).toBe(true);
    expect(isActivePublishStatus("published")).toBe(false);
    expect(isActivePublishStatus("failed")).toBe(false);
    expect(isActivePublishStatus("unknown")).toBe(false);
  });
});