class AuthServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AuthServiceError"
    this.status = status
  }
}

export { AuthServiceError }
