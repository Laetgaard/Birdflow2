/** Check results are evidence, not design scores or a publication approval. */
export type ReadinessCheck = {
  status: 'passed' | 'needs_repair' | 'needs_owner_input' | 'unavailable' | 'not_applicable';
  messages: string[];
};

export type WebsiteReadiness = {
  builderRevision: number;
  fingerprint: string;
  briefRevision: number | null;
  checks: {
    content: ReadinessCheck;
    visualReview: ReadinessCheck;
    bookingSetup: ReadinessCheck;
  };
};
