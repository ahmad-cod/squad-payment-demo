from fastapi import FastAPI, HTTPException, Request, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv
import hmac
import hashlib
import json
# from typing import Optional

load_dotenv()

app = FastAPI(
    title="Squad Pay",
    description="Integrating API for handling payments using Squad in a FastAPI application",
    version="1.0.0"
)

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SQUAD_SECRET_KEY = os.getenv("SQUAD_SECRET_KEY", "sk_test_your_key_here")
BASE_URL = "https://sandbox-api-d.squadco.com"

@app.get("/")
async def root():
    return {"message": "Welcome to the Squad Payment API"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0", port=port)

@app.post("/initiate-payment")
async def initiate_payment(amount: int, email: str, is_recurring: bool = False):
    print("Initiating payment...")
    url = f"{BASE_URL}/transaction/initiate"
    
    headers = {
        "Authorization": f"Bearer {SQUAD_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    # Amount is in Kobo (e.g., 500000 = 5,000 Naira)
    payload = {
        "amount": amount,
        "email": email,
        "currency": "NGN",
        "initiate_type": "inline",
        "is_recurring": is_recurring,
        "callback_url": "https://linkedin.com/in/ahmadaroyehun"
        # "callback_url": "http://localhost:3000/callback" 
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        
    if response.status_code != 200:
        print("Failed to initiate transaction:", response.text)
        raise HTTPException(status_code=400, detail="Failed to initialize transaction")
    return response.json()

@app.get("/verify-payment/{transaction_ref}")
async def verify_payment(transaction_ref: str):
    url = f"{BASE_URL}/transaction/verify/{transaction_ref}"
    
    headers = {"Authorization": f"Bearer {SQUAD_SECRET_KEY}"}

    print("Verifying transaction: ", transaction_ref)
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        # Ensure the payment status is actually 'success'
        if data.get("data", {}).get("transaction_status") == "success":
            return {"status": "paid", "message": "Transaction verified successfully"}
    
    raise HTTPException(status_code=400, detail="Transaction verification failed")

@app.post("/webhook")
async def webhook(request: Request):
    body = await request.body()
    x_squad_encrypted_body = request.headers.get("x-squad-encrypted-body")
    if not x_squad_encrypted_body:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-SQUAD-ENCRYPTED-BODY header")
    
    # Verify the signature
    computed_signature = hmac.new(
        SQUAD_SECRET_KEY.encode('utf-8'),
        body,
        hashlib.sha512
    ).hexdigest().upper()

    if not hmac.compare_digest(computed_signature, x_squad_encrypted_body.upper()):
        print("Invalid signature. Computed:", computed_signature, "Received:", x_squad_encrypted_body.upper())
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    # Process the webhook payloadB", 
    payload = json.loads(body)
    print("Webhook payload: ", payload)
    body_data = payload.get("Body", {})
    event_type = body_data.get("event_type")

    if event_type == "charge_successful":
        transaction_ref = body_data.get("transaction_ref")
        amount_in_naira = body_data.get("amount") / 100  # Convert from Kobo to Naira
        customer_email = body_data.get("email")
        print(f"Charge successful for transaction: {transaction_ref}")

    # Here I can add logic to update database or trigger other actions based on the webhook data
    # Logic: 1. Check if transaction_ref exists in DB
    # 2. Check if status is already 'success' (Idempotency)
    # 3. Update DB to 'success'
    # 4. Grant access/Send confirmation email

    return {"status": "success", "message": "Webhook received and verified"}