from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

# ==========================================
# TABLAS INTERMEDIAS (Muchos a Muchos)
# ==========================================

# Relación entre users y sus activities preferidas
user_preferences = db.Table('user_preferences',
    db.Column('users_id', db.Integer, db.ForeignKey('Users.id', ondelete='CASCADE'), primary_key=True),
    db.Column('acivities_id', db.Integer, db.ForeignKey('Activities.id', ondelete='CASCADE'), primary_key=True)
)

# Relación entre Sitios y las activities que ofrecen
site_activities = db.Table('site_activities',
    db.Column('sitio_id', db.Integer, db.ForeignKey('Sites.id', ondelete='CASCADE'), primary_key=True),
    db.Column('activity_id', db.Integer, db.ForeignKey('Activities.id', ondelete='CASCADE'), primary_key=True)
)

# ==========================================
# MODELOS PRINCIPALES
# ==========================================

class User(db.Model):
    __tablename__ = 'Users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    biografia = db.Column(db.String(255))
    foto_perfil = db.Column(db.String(255), default='default_profile.png')
    fecha_registro = db.Column(db.DateTime, default=datetime.now(timezone.utc))

    # Relationship with Activities (user preferences)
    preferences = db.relationship('Activity', secondary=user_preferences, 
                                    backref=db.backref('users_interesados', lazy='dynamic'))

    def __repr__(self):
        return f'<User {self.username}>'


class Barrio(db.Model):
    __tablename__ = 'Barrios'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True) # Ej: "Chapinero Alto"
    localidad = db.Column(db.String(100), nullable=False)           # Ej: "Chapinero"
    
    # Relationship: One neighbourhood, many visit sites
    sitios = db.relationship('Sitio', backref='sector', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Barrio {self.nombre}>'


class Sitio(db.Model):
    __tablename__ = 'Sites'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    direccion = db.Column(db.String(150))
    latitud = db.Column(db.Float, nullable=False)  # Coordenada x para el mapa
    longitud = db.Column(db.Float, nullable=False) # Coordenada y para el mapa
    descripcion = db.Column(db.Text)
    rango_precio = db.Column(db.String(10))        # Ej: "$", "$$", "$$$"
    imagen_url = db.Column(db.String(255))
    
    # Clave foránea hacia Barrio
    barrio_id = db.Column(db.Integer, db.ForeignKey('Barrios.id'), nullable=False)
    
    # Relación con activities (Qué se puede hacer aquí)
    activities = db.relationship('Acivity', secondary=site_activities, 
                                   backref=db.backref('sitios_disponibles', lazy='dynamic'))

    def __repr__(self):
        return f'<Sitio {self.nombre}>'


class Activity(db.Model):
    __tablename__ = 'Activities'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), unique=True, nullable=False) # Ej: "Pola artesanal", "Baile", "Café"
    icono = db.Column(db.String(50)) # Nombre de icono para el frontend (ej: "beer-outline")

    def __repr__(self):
        return f'<Acivity {self.nombre}>'
    

class Review(db.Model):
    __tablename__ = 'Reviews'

    id = db.Column(db.Integer, primary_key=True)
    official = db.Column(db.Boolean, default=False)
    

