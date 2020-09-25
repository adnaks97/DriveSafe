import sqlalchemy
import pymysql
import pandas as pd
import os

class CloudSQLDAO:
    def __init__(self):

        env =  os.environ.get('APP_ENV_VAR','')
        if env.startswith('gae'):
            db_user = os.environ.get('CLOUD_SQL_USERNAME')
            db_pass = os.environ.get('CLOUD_SQL_PASSWORD')
            db_name = os.environ.get('CLOUD_SQL_DATABASE_NAME')
            db_connection_name = os.environ.get('CLOUD_SQL_CONNECTION_NAME')
            db = sqlalchemy.create_engine(
                # mysql+pymysql://<db_user>:<db_pass>@/<db_name>?unix_socket=/cloudsql/<cloud_sql_instance_name>
                sqlalchemy.engine.url.URL(
                    drivername="mysql+pymysql",
                    username=db_user,
                    password=db_pass,
                    database=db_name,
                    query={"unix_socket": "/cloudsql/{}".format(db_connection_name)})
            )
        else:
            db_user = '' # Fill with user credential
            db_pass = '' # Fill with password
            db_name = 'drivesafe_app_accidents'
            db = sqlalchemy.create_engine('mysql+pymysql://{}:{}@127.0.0.1/{}'.format(db_user,db_pass,db_name))
        self.conn = db.connect()

    def get_accidents_by_zipcode(self, zipcode):
        sql = "select ID,Start_Lat,Start_Lng from accidents where Zipcode={}".format(zipcode)
        return pd.read_sql(sql, self.conn)
