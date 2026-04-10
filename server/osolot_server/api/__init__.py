from ninja import NinjaAPI

from .auth_routes import auth_router
from .user_routes import users_router

api = NinjaAPI(
    title="Osolot API",
    version="0.0.1",
    description="API for managing decentralized libraries of things.",
    urls_namespace="api",
)

api.add_router("/auth", auth_router)
api.add_router("/users", users_router)

__all__ = ["api"]
