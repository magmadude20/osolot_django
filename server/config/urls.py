from django.contrib import admin
from django.urls import include, path

from osolot_server.api import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
