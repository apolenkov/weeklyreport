export class ProjectActivityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectActivityNotFoundError";
  }
}

export class ProjectActivityDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectActivityDomainError";
  }
}

export class ProjectActivityConflictError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectActivityConflictError";
  }
}
