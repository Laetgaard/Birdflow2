export type PublishJobStatus =
  | "queued"
  | "generating"
  | "uploading"
  | "deploying"
  | "waiting_for_alias"
  | "activating"
  | "published"
  | "failed";

export type PublishFailureDetails = {
  stage?: string;
  pageName?: string;
  componentId?: string;
  componentType?: string;
};

export type PublishJobSummary = {
  jobId: string;
  status: PublishJobStatus | string;
  productionUrl: string | null;
  errorCode: string | null;
  errorMessage?: string | null;
  failureDetails: PublishFailureDetails | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

export type PublishPreflightFailure = {
  code?: string | null;
  status?: number;
};

export type PublishPresentation = {
  title: string;
  description: string;
  stage: "saving" | "preparing" | "uploading" | "building" | "url" | "published" | "failed";
};

export const PUBLISH_STAGE_ORDER: PublishPresentation["stage"][] = [
  "saving",
  "preparing",
  "uploading",
  "building",
  "url",
];

export const PUBLISH_STAGE_LABELS: Record<PublishPresentation["stage"], string> = {
  saving: "Saving changes",
  preparing: "Preparing your website",
  uploading: "Uploading to Vercel",
  building: "Building on Vercel",
  url: "Setting up your public URL",
  published: "Published",
  failed: "Publishing stopped",
};

export function isActivePublishStatus(status: string | null | undefined): boolean {
  return [
    "queued",
    "generating",
    "uploading",
    "deploying",
    "waiting_for_alias",
    "activating",
  ].includes(status ?? "");
}

export function getPublishPresentation(
  job: PublishJobSummary | null,
  isSaving: boolean,
  preflightFailure: PublishPreflightFailure | null,
): PublishPresentation {
  if (preflightFailure) {
    return {
      title: "We could not start publishing",
      description: getPreflightFailureMessage(preflightFailure),
      stage: "failed",
    };
  }
  if (isSaving || !job) {
    return {
      title: "Saving changes",
      description: "We are saving the latest version before it is sent to Vercel.",
      stage: "saving",
    };
  }

  switch (job.status) {
    case "queued":
    case "generating":
      return {
        title: "Preparing your website",
        description: "We are preparing the version you chose to publish.",
        stage: "preparing",
      };
    case "uploading":
      return {
        title: "Uploading to Vercel",
        description: "Your website files are being sent to its Vercel project.",
        stage: "uploading",
      };
    case "deploying":
      return {
        title: "Building on Vercel",
        description: "Vercel is building a safe preview of your website before it goes live.",
        stage: "building",
      };
    case "waiting_for_alias":
    case "activating":
      return {
        title: "Setting up your public URL",
        description: "The new version is ready. We are making it live and confirming its public address.",
        stage: "url",
      };
    case "published":
      return {
        title: "Your website is live",
        description: "Your published website is ready to visit.",
        stage: "published",
      };
    case "failed":
      return {
        title: "Publishing stopped",
        description: getPublishFailureMessage(job),
        stage: "failed",
      };
    default:
      return {
        title: "Checking publish status",
        description: "We received an unfamiliar status from the publishing service. Your website has not been changed while we check it.",
        stage: "preparing",
      };
  }
}

export function getPreflightFailureMessage(failure: PublishPreflightFailure): string {
  switch (failure.code) {
    case "STALE_PUBLISH_REVISION":
      return "Your website changed while it was being saved. Review the latest version, then try publishing again.";
    case "BOOKING_SETUP_REQUIRED":
      return "Native booking is not ready to publish yet. Finish setting up services and availability, then try again.";
    case "VERCEL_PROJECT_RECOVERY_REQUIRED":
      return "We could not safely reconnect this website to its existing Vercel project, so a duplicate project was not created.";
    default:
      if (failure.status === 503) {
        return "The publishing service is starting up. Your website was not sent to Vercel; try again in a moment.";
      }
      if (failure.status === 401 || failure.status === 403) {
        return "You do not have permission to publish this website.";
      }
      return "Your website was not sent to Vercel. Check the required website setup, then try again.";
  }
}

export function getPublishFailureMessage(job: Pick<PublishJobSummary, "errorCode" | "failureDetails">): string {
  if (job.errorCode === "SERVER_RESTART") {
    return "The publishing service restarted before this publish could finish. Your live website was not changed; you can publish again.";
  }
  if (job.errorCode === "VERCEL_PROJECT_RECOVERY_REQUIRED") {
    return "We could not safely reconnect this website to its existing Vercel project, so a duplicate project was not created.";
  }
  if (job.errorCode === "ACTIVATION_NOT_PROMOTED") {
    return "Vercel could not make this version live. Your existing website was not changed.";
  }

  switch (job.failureDetails?.stage) {
    case "normalization":
    case "validation":
    case "generating":
      return "We could not prepare this version of your website. Review your recent changes and try publishing again.";
    case "type_check":
      return "This version contains a website change that could not be built safely. Review the affected section and try again.";
    case "upload":
      return "We could not upload this version to Vercel. Your live website was not changed.";
    case "deployment":
      return "Vercel could not build this version of your website. Your live website was not changed.";
    case "alias":
      return "Vercel finished the deployment but did not confirm a public website address. Your existing website was not changed.";
    case "verification":
      return "We could not verify the new version before making it live. Your existing website was not changed.";
    case "activation":
      return "Vercel could not make this version live. Your existing website was not changed; you can try publishing again.";
    default:
      return "Publishing could not finish safely. Your existing website was not changed; you can try again.";
  }
}

export function getPublishFailureContext(job: PublishJobSummary | null): string | null {
  if (!job?.failureDetails) return null;
  if (job.failureDetails.pageName) return `Related page: ${job.failureDetails.pageName}.`;
  if (job.failureDetails.componentType) return `Related part: ${job.failureDetails.componentType}.`;
  return null;
}