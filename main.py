
from __future__ import print_function

# [START gae_flex_websockets_app]
from flask import Flask, render_template
from flask_sockets import Sockets
import time
import json
from geopy.geocoders import Nominatim
from geopy.distance import distance
import pandas as pd
#from CloudSQLDAO import CloudSQLDAO
import logging
import random
import time
from  geopy.exc import GeocoderTimedOut, GeocoderServiceError

locator = Nominatim(user_agent="myGeocoder")
app = Flask(__name__)
sockets = Sockets(app)
#dao = CloudSQLDAO()


def infer_warning_score(curr_lat,curr_lng,zipcode_accidents):
    def get_points_within_radius(row,curr_lat,curr_lng,thresh=0.2):
        curr_loc =(curr_lat,curr_lng)
        row_loc = (row['Start_Lat'],row['Start_Lng'])
        dist = distance(row_loc,curr_loc).miles
        if(dist<=thresh):
            return True
        else:
            return False
    if(len(zipcode_accidents)==0):
        return 0
    else:
        result = zipcode_accidents.apply(get_points_within_radius,args=(curr_lat,curr_lng),axis=1)
        return int(result.sum()) #for now returning counts


def reverse_geocode(geolocator, latlon, sleep_sec=2):
    try:
        return geolocator.reverse(latlon)
    except GeocoderTimedOut:
        logging.info('TIMED OUT: GeocoderTimedOut: Retrying...')
        time.sleep(random.randint(1*100,sleep_sec*100)/100)
        return reverse_geocode(geolocator, latlon, sleep_sec)
    except GeocoderServiceError as e:
        logging.info('CONNECTION REFUSED: GeocoderServiceError encountered.')
        logging.error(e)
        return None
    except Exception as e:
        logging.info('ERROR: Terminating due to exception {}'.format(e))
        return None

@sockets.route('/location')
def socket_connection(ws):

    zipcode_accidents = None
    prev_zipcode = None
    while not ws.closed:
        message = ws.receive()
        if message is None:  # message is "None" if the client has closed.
            continue
        # Send the message to all clients connected to this webserver
        # process. (To support multiple processes or instances, an
        # extra-instance storage or messaging system would be required.)
        #clients = ws.handler.server.clients.values()
        #for client in clients:
            #client.ws.send(message)
        print("Incoming message: ", message)
        json_messsage = json.loads(message)
        msg_id = json_messsage['id']
        lat, lng = json_messsage['lat'],json_messsage['lng']

        zipcode_object = reverse_geocode(locator, (lat, lng), sleep_sec=2) ##Change sleep_sec accordingly
        #zipcode_object = locator.reverse((lat,lng))
        curr_zipcode = zipcode_object.raw['address']['postcode'].split('-')[0] #change this to low level zipcode later


        print("Prev Zipcode: ", prev_zipcode)
        print("Current Zipcode: ", curr_zipcode)
        #if(curr_zipcode != prev_zipcode):
        #    zipcode_accidents = dao.get_accidents_by_zipcode(curr_zipcode)
        #print("Zipcode accident count: ", len(zipcode_accidents))

        #warning_score = infer_warning_score(lat,lng,zipcode_accidents)
        #print("Warning score: ", warning_score)

        output_map = {}
        output_map['id'] = msg_id
        output_map['warning_score'] = 0
        output_map['warning_level'] = curr_zipcode
        print("------------------------------------")
        ws.send(json.dumps(output_map))

# [END gae_flex_websockets_app]


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    print("""
This can not be run directly because the Flask development server does not
support web sockets. Instead, use gunicorn:

gunicorn -b 127.0.0.1:8080 -k flask_sockets.worker main:app

""")
