var map;
var directionsService;
var marker = [];
var polyLine = [];
var poly2 = [];
var startLocation = [];
var endLocation = [];
var timerHandle = [];
var infoWindow = null;

var startLoc = [];
var endLoc = [];

var lastVertex = 1;
var step = 50; // 5; // metres
var eol = [];
var send_count = 0;
var msg_id = 0;
var speed = 60;
window.initialize = initialize;
window.setRoutes = setRoutes;
var scheme = window.location.protocol == "https:" ? 'wss://' : 'ws://';
var webSocketUri =  scheme
    + window.location.hostname
    + (location.port ? ':'+location.port: '')
    + '/location';
const ws = new WebSocket(webSocketUri);

// called on body load
function initialize() {

    var sp = parseInt($('#miles').val());
    if(sp == 0)
        speed = 100000;
    else
        speed = 111600/sp;
    ws.onopen = function() {
        console.log('WebSocket Client Connected');
        // ws.send('Hi this is web client.');
    };
    //code to be changed, add a new variable which tracks the current received msg id, if an old id is received discard it, put it in if itself
    ws.onmessage = function(e) {
        var result = JSON.parse(e.data);

        if( result["warning_score"] <5 ) {
            $('.text').css("background-color", "green");
            $('.text').text("lol");
        }else if(result["warning_score"] >5 && result["warning_score"] < 15){
            $('.text').css("background-color", "orange");
            $('.text').text("Stay alert while driving!");
        }else{
            $('.text').css("background-color", "red");
            $('.text').text("Drive slow! Accident prone area.");
        }

        console.log("Received: '" + e.data + "'");
    };
    // initialize infoWindow
    infoWindow = new google.maps.InfoWindow({
        size: new google.maps.Size(150, 50)
    });
    var options = {
        // max zoom
        zoom: 18
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), options);
    //
    // initial location which loads up on map
    address = 'California'

    // Geocoder is used to encode or actually geocode textual addresses to lat long values
    geocoder = new google.maps.Geocoder();
    geocoder.geocode({'address': address}, function (results, status) {
        map.fitBounds(results[0].geometry.viewport);
    });
}

// returns the marker
function createMarker(latlng, label, html) {
    var contentString = '<b>' + label + '</b><br>' + html;
    // using Marker api, marker is created
    var marker = new google.maps.Marker({
        position: latlng,
        map: map,
        title: label,
        zIndex: 10
    });
    marker.myname = label;
    // adding click listener to open up info window when marker is clicked
    google.maps.event.addListener(marker, 'click', function () {
        infoWindow.setContent(contentString);
        infoWindow.open(map, marker);
    });
    return marker;
}

function toggleError(msg){
    document.getElementById('error-msg').innerText = msg;
}

// Using Directions Service find the route between the starting and ending points
function setRoutes() {
    map && initialize();
    // empty out the error msg
    toggleError("");
    // set the values and check if any is empty, and if yes, show error and return
    var startVal = document.getElementById("start").value
    var endVal = document.getElementById("end").value;
    if (!startVal || !endVal){
        toggleError( "Please enter both start and end locations.");
        return;
    }
    // just to avoid weird case of same start and end location
    if (startVal === endVal){
        toggleError( "Please enter different locations in both inputs");
        return;
    }
    startLoc[0] = startVal;
    endLoc[0] = endVal;

    // empty out previous values
    startLocation = [];
    endLocation = [];
    polyLine = [];
    poly2 = [];
    timerHandle = [];

    var directionsDisplay = new Array();
    for (var i = 0; i < startLoc.length; i++) {
        var rendererOptions = {
            map: map,
            suppressMarkers: true,
            preserveViewport: true
        };
        directionsService = new google.maps.DirectionsService();
        var travelMode = google.maps.DirectionsTravelMode.DRIVING;
        var request = {
            origin: startLoc[i],
            destination: endLoc[i],
            travelMode: travelMode
        };
        directionsService.route(request, makeRouteCallback(i, directionsDisplay[i]), rendererOptions);
    }
}

// called after getting route from directions service, does all the heavylifting
function makeRouteCallback(routeNum, disp, rendererOptions) {
    // check if polyline and map exists, if yes, no need to do anything else, just start the animation
    if (polyLine[routeNum] && (polyLine[routeNum].getMap() != null)) {
        startAnimation(routeNum);
        return;
    }
    return function (response, status) {
        // if directions service successfully returns and no polylines exist already, then do the following
        if (status == google.maps.DirectionsStatus.ZERO_RESULTS){
            toggleError("No routes available for selected locations");
            return;
        }
        if (status == google.maps.DirectionsStatus.OK) {
            startLocation[routeNum] = new Object();
            endLocation[routeNum] = new Object();
            // set up polyline for current route
            polyLine[routeNum] = new google.maps.Polyline({
                path: [],
                strokeColor: '#FFFF00',
                strokeWeight: 3
            });
            poly2[routeNum] = new google.maps.Polyline({
                path: [],
                strokeColor: '#FFFF00',
                strokeWeight: 3
            });
            // For each route, display summary information.
            var legs = response.routes[0].legs;
            // directionsrenderer renders the directions obtained previously by the directions service
            disp = new google.maps.DirectionsRenderer(rendererOptions);
            disp.setMap(map);
            disp.setDirections(response);

            // create Markers
            for (i = 0; i < legs.length; i++) {
                // for first marker only
                if (i == 0) {
                    startLocation[routeNum].latlng = legs[i].start_location;
                    startLocation[routeNum].address = legs[i].start_address;
                    marker[routeNum] = createMarker(legs[i].start_location, "start", legs[i].start_address, "green");
                }
                endLocation[routeNum].latlng = legs[i].end_location;
                endLocation[routeNum].address = legs[i].end_address;
                var steps = legs[i].steps;
                for (j = 0; j < steps.length; j++) {
                    var nextSegment = steps[j].path;
                    for (k = 0; k < nextSegment.length; k++) {
                        polyLine[routeNum].getPath().push(nextSegment[k]);
                    }
                }
            }
        }
        if (polyLine[routeNum]){
            // render the line to map
            polyLine[routeNum].setMap(map);
            // and start animation
            startAnimation(routeNum);
        }
    }
}

// Spawn a new polyLine every 20 vertices
function updatePoly(i, d) {
    if (poly2[i].getPath().getLength() > 20) {
        poly2[i] = new google.maps.Polyline([polyLine[i].getPath().getAt(lastVertex - 1)]);
    }

    if (polyLine[i].GetIndexAtDistance(d) < lastVertex + 2) {
        if (poly2[i].getPath().getLength() > 1) {
            poly2[i].getPath().removeAt(poly2[i].getPath().getLength() - 1)
        }
        poly2[i].getPath().insertAt(poly2[i].getPath().getLength(), polyLine[i].GetPointAtDistance(d));
    } else {
        poly2[i].getPath().insertAt(poly2[i].getPath().getLength(), endLocation[i].latlng);
    }
}

// updates marker position to make the animation and update the polyline
function animate(index, d, tick) {
    if (d > eol[index]) {
        marker[index].setPosition(endLocation[index].latlng);
        return;
    }
    var p = polyLine[index].GetPointAtDistance(d);

    var obj = {};
    obj.lat = p.lat();
    obj.lng = p.lng();
    obj.id = msg_id;
    obj.frequency = speed;
    //if(send_count%4 ==0) {
    ws.send(JSON.stringify(obj));
    msg_id++;
    //}
    send_count++;
    console.log(send_count);
    marker[index].setPosition(p);
    updatePoly(index, d);
    timerHandle[index] = setTimeout("animate(" + index + "," + (d + step) + ")", tick || speed);
}

// start marker movement by updating marker position every 100 milliseconds i.e. tick value
function startAnimation(index) {
    if (timerHandle[index])
        clearTimeout(timerHandle[index]);
    eol[index] = polyLine[index].Distance();
    map.setCenter(polyLine[index].getPath().getAt(0));

    poly2[index] = new google.maps.Polyline({
        path: [polyLine[index].getPath().getAt(0)],
        strokeColor: "#FFFF00",
        strokeWeight: 3
    });
    timerHandle[index] = setTimeout("animate(" + index + ",50)", 2000);  // Allow time for the initial map display
}
