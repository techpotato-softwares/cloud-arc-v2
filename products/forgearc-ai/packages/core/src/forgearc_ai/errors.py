class ForgeArcError(Exception):
    status = 400
    code = "forgearc_error"


class ConfigError(ForgeArcError):
    status = 500
    code = "config"


class Unauthorized(ForgeArcError):
    status = 401
    code = "unauthorized"


class Forbidden(ForgeArcError):
    status = 403
    code = "forbidden"


class BudgetExceeded(ForgeArcError):
    status = 429
    code = "budget_exceeded"


class RateLimited(ForgeArcError):
    status = 429
    code = "rate_limited"


class PolicyError(ForgeArcError):
    status = 422
    code = "policy"


class ProviderError(ForgeArcError):
    status = 502
    code = "provider"


class NotFound(ForgeArcError):
    status = 404
    code = "not_found"
