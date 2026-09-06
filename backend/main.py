from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import faiss
import numpy as np
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chunks_store = []
index = None

def chunk_text(text, chunk_size=500, overlap=50):
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

def get_embeddings(texts):
    embeddings = []
    for text in texts:
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text,
            task_type="retrieval_document"
        )
        embeddings.append(result["embedding"])
    return np.array(embeddings).astype("float32")

def get_query_embedding(text):
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="retrieval_query"
    )
    return np.array([result["embedding"]]).astype("float32")

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global chunks_store, index

    reader = PdfReader(file.file)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No text found in PDF")

    chunks_store = chunk_text(full_text)
    embeddings = get_embeddings(chunks_store)

    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    return {"message": "PDF processed", "chunks": len(chunks_store)}

@app.post("/ask")
async def ask_question(question: str):
    global chunks_store, index

    if index is None:
        raise HTTPException(status_code=400, detail="Upload a PDF first")

    q_embedding = get_query_embedding(question)
    k = 3
    distances, indices = index.search(q_embedding, k)
    relevant_chunks = [chunks_store[i] for i in indices[0]]
    context = "\n\n".join(relevant_chunks)

    prompt = f"Answer the question using only this context:\n\n{context}\n\nQuestion: {question}"

    model = genai.GenerativeModel("gemini-3.6-flash")
    response = model.generate_content(prompt)

    return {"answer": response.text, "sources": relevant_chunks}