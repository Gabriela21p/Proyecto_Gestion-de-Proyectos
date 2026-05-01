import os
from flask import Flask
from app.models import User, Sitio, Barrio, Activity, user_preferences, site_activities, db

def create_app():
    app = Flask(__name__)

    # 1. SQLite db setup
    # Get absolute path of db file
    basedir = os.path.abspath(os.path.dirname(__file__))
    database_path = os.path.join(basedir, 'instance', 'app.db')
    
    # Check for "instance" directory
    if not os.path.exists(os.path.join(basedir, 'instance')):
        os.makedirs(os.path.join(basedir, 'instance'))

    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{database_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # 2. Initialize app db
    db.init_app(app)

    # 3. Create tables
    # Read models and creates file if not found
    with app.app_context():
        db.create_all()
        print(f"¡Base de datos creada en: {database_path}!")

    return app

main = create_app()

@main.route('/')
def index():
    return {"message": "Servidor de Parches Bogotá corriendo"}

if __name__ == '__main__':
    main.run(debug=True)