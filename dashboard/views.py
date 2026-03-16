from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse
from .services import get_topology_data


def index(request):
    return render(request, "dashboard/index.html")


def topology_api(request):
    data = get_topology_data()
    return JsonResponse(data)