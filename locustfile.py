from locust import HttpUser, task, between

class QuickstartUser(HttpUser):
    wait_time = between(1, 2)
    
    @task
    def load_getPrice(self):
        self.client.get("/webSocket/price/AAPL")  

    @task
    def load_getMarketStatus(self):
        self.client.get("/getMarketStatus")

 
