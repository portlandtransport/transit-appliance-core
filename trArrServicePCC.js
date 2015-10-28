/*
   Copyright 2010-2011 Portland Transport

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

function trArrServicePCCCreateUpdaters(arrivals_object, service_requests, updaters) {
	
	var max_stops_per_request = 10;

	// PCC allows a max of 10 stops in one request, so split things up into multiple updater objects if need be
	while (service_requests.length > 0) {
		if (service_requests.length > max_stops_per_request) {
			updaters.push(new trArrPCCUpdater(service_requests.slice(0,max_stops_per_request),arrivals_object));
			service_requests = service_requests.slice(max_stops_per_request);
		} else {
			updaters.push(new trArrPCCUpdater(service_requests,arrivals_object));
			service_requests = [];
		}
	}

}



function trArrPCCUpdater(service_requests,arrivals_object) {
	
	var updater = this;
	
	updater.access_method = "jsonp";
	
	// every updater object needs to maintain a queue
	this.arrivals_queue = [];
	this.service_messages = [];
	this.connection_health = [];
	
	this.update_interval = 60*1000;
	this.health_limit = Math.floor(60*60*1000/this.update_interval);
	
	var request_object = {}; // hash to use for testing arrivals against request
	
	var stop_id_hash = {};
	var stop_id_list = [];
	for (var i = 0; i < service_requests.length; i++) {
		stop_id_list.push(service_requests[i].stop_id);
		stop_id_hash[service_requests[i].stop_id] = true;
		request_object[service_requests[i].stop_id] = {};
		for (var j = 0; j < service_requests[i].routes.length; j++) {
			request_object[service_requests[i].stop_id][service_requests[i].routes[j].route_id] = true;
		}
	}
	var stop_string = stop_id_list.join(',');
	this.url = "http://shuttle.pcc.edu/Services/JSONPRelay.svc/GetRouteStopArrivals?APIKey=8882812681";
	
	// functions that will be polled by the arrivals object
	this.arrivals = function() {
		return this.arrivals_queue;
	}
	
	this.messages = function() {
		return this.service_messages;
	}
	
	this.connection = function() {
		return this.connection_health;
	}	
	
	this.update_connection_health = function(success_status) {
	    updater.connection_health.unshift( { success: success_status, timestamp: localTime().getTime() } );
  	if (updater.connection_health.length > this.health_limit) {
  		updater.connection_health.length = this.health_limit; // limit to last hour
  	}
	}
	
	this.trArrPCCRequestLoop = function() {
		
		var RouteStopLocations = {
			"559": "Cascade",
			"563": "Cascade",
			"550": "Cascade",
			"537": "RockCreek",
			"565": "RockCreek",
			"548": "Southeast",
			"542": "Southeast",
			"561": "Southeast",
			"534": "Sylvania",
			"536": "Sylvania",
			"547": "Sylvania",
			"549": "Sylvania",
			"541": "Sylvania"
		};
		
		var headsigns = {
			"559": "Purple Shuttle to Southeast",
			"563": "Red Shuttle to Rock Creek",
			"550": "Green Shuttle to Sylvania",
			"537": "Blue Shuttle to Sylvania",
			"565": "Red Shuttle to Cascade",
			"548": "Yellow Express to Sylvania",
			"542": "Yellow Shuttle to Sylvania",
			"561": "Purple Shuttle to Cascade",
			"534": "Orange Shuttle to Downtown",
			"536": "Blue Shuttle to Rock Creek",
			"547": "Yellow Express to Southeast",
			"549": "Green Shuttle to Cascade",
			"541": "Yellow Shuttle via Hawthorne to Southeast"
		};

				
		updater.process_results = function(data) {
	  	updater.update_connection_health(true);

	  	var local_queue = [];
	  	var update_time = localTime().getTime();
	  	
	  	console.log(this);

			for (var i = 0; i < data.length; i++){ 
				var arrival_set = data[i];
				/*console.log(arrival_set.RouteID);
				console.log(arrival_set.RouteStopID);*/
	
				/* need to replace this with routeStopID logic
				if (request_object[arrival.locid] == undefined || request_object[arrival.locid][arrival.route] == undefined) {
					continue; // don't process an arrival if it wasn't in the stop list
				}
				*/
				
				if (typeof arrival_set.VehicleEstimates !== "undefined") {
					
					for (var j = 0; j < arrival_set.VehicleEstimates.length; j++){ 
						
						var arrival = arrival_set.VehicleEstimates[j];
						
						if (arrival.OnRoute == true) {
										
						  var entry = new transitArrival();
						  entry.type = "estimated";
						  entry.arrivalTime = (new Date()).getTime() + 1000*arrival.SecondsToStop;
							entry.headsign = headsigns[arrival_set.RouteStopID];
							entry.app_headsign_less_route = entry.headsign;
							entry.app_color = 8;
							entry.stop_id = RouteStopLocations[arrival_set.RouteStopID];
							if (typeof entry.stop_id == "undefined") {
								continue;
							}
							if (!this.stop_id_hash[entry.stop_id]) {
								continue;
							}
							var stop_data = trStopCache().stopData('PCC',entry.stop_id);
							entry.stop_data = copyStopData(stop_data);
							entry.route_id = arrival_set.RouteID;
							entry.app_route_id = entry.route_id;
							entry.route_data = {};
							entry.route_data.agency = "PCC";
							entry.route_data.service_class = 7;
							entry.route_data.direction_id = 0;
							entry.route_data.route_id = arrival_set.RouteID;
							entry.agency = "PCC";
							entry.avl_agency_id = "PCC";
							entry.alerts = ""; // need to figure this out later
							entry.last_updated = update_time;
							if (typeof entry.headsign == "undefined") {
								continue;
							}
							console.log(entry);
							local_queue.push(entry);
						}
					}
				}
			}

			
			// now copy to externally visble queue, making sure we're not in the middle of a query
			updater.arrivals_queue = local_queue;
			//trArrLog("<PRE>"+dump(updater.arrivals_queue)+"</PRE>");
				
		}


		jQuery.ajax({
		  url: updater.url,
		  context: {stop_id_hash: stop_id_hash},
		  dataType: updater.access_method,
		  cache: false,
		  jsonp: "method",
		  error: function(data) {
		  	// first retry
				jQuery.ajax({
					stop_string: stop_string,
				  url: updater.url,
				  dataType: updater.access_method,
				  cache: false,
				  error: function(data) {
				  	// second retry
						jQuery.ajax({
							context: {stop_id_hash: stop_id_hash},
						  url: updater.url,
						  dataType: updater.access_method,
						  cache: false,
						  error: function(data) {
						  	updater.update_connection_health(false);
						  	throw "PCC Arrivals Error";
						  },
						  success: updater.process_results
						});
				  },
				  success: updater.process_results
				});
		  },
		  success: updater.process_results
		});

	}
	
	updater.trArrPCCRequestLoop(); // first time immediately
	setInterval(updater.trArrPCCRequestLoop,updater.update_interval);

}

function copyStopData(data) {
	var out = {};
	for (var element in data) {
		// strip it down to just the GTFS elements
		if (element != 'routes' && element != 'geometry' && element != 'doc_type' && element.substring(0,1) != '_') {
			out[element] = data[element]
		}
	}
	return out;
}