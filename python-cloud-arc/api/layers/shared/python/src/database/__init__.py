from __future__ import annotations
import os
from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlmodel import SQLModel

_engine = None
_SessionLocal = None

def get_engine():
    global _engine
    if _engine is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            from config import get_local_database_config, build_database_url
            url = build_database_url(get_local_database_config())
        _engine = create_engine(url, pool_pre_ping=True, pool_size=5)
    return _engine

def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autocommit=False, autoflush=False, class_=Session)
    return _SessionLocal

def get_session() -> Session:
    return get_session_factory()()

def init_db():
    SQLModel.metadata.create_all(get_engine())
