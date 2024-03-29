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

function trStopCache() {
	
	// ensure this is called as constructor
	
	if (!(this instanceof trStopCache)) {
		return new trStopCache();
	}
	
	// make this a singleton
	
	if (typeof trStopCache.instance === "object") {
		return trStopCache.instance;
	}
	
	trStopCache.instance = this;
	
	this.cache = {}; // our cache element
	
	this.addToCache = function(agency,stop_id,data) {
		if (this.cache[agency] == undefined) {
			this.cache[agency] = {};
		}
		this.cache[agency][stop_id] = data;
	}
	
  	
	this.checkCached = function(arrivals_object,stop_config,callback) {
		// initialize recursive retrieval of cache items
		var next_stop = this.nextUncachedStop(stop_config);
		this.getCacheItem(arrivals_object,stop_config,next_stop,callback);
    
	}
	
	this.getCacheItem = function(arrivals_object,stop_config,stop,callback) {
		
		var stops_db = "transit_stops_production";
		if (document.domain.substring(0,3) == 'dev') {
			var stops_db = "transit_stops_loading";
		}
			
		
		// get the stop info
		//var service_url = "http://transitappliance.iriscouch.com/"+stops_db+"/"+stop.agency+":"+stop.stop_id;
		/*
		var service_url = "http://transitappliance.iriscouch.com/" + 
		stops_db + "/_design/get/_view/by_id?key=%22"+stop.agency+
		":"+stop.stop_id+"%22";
		var alternate_url = "http://transitappliance.cloudant.com/" + 
		stops_db + "/_design/get/_view/by_id?key=%22"+stop.agency+
		":"+stop.stop_id+"%22";
		*/
		
		var service_url = "http://stops4.transitappliance.com/stop/"+stop.agency+":"+stop.stop_id;
		var alternate_url = "http://stops3.transitappliance.com/stop/"+stop.agency+":"+stop.stop_id;
		
		if (document.location.protocol == 'https:') {
    		service_url = "https://stops6.transitappliance.com/stop/"+stop.agency+":"+stop.stop_id;
    		alternate_url = "https://stops7.transitappliance.com/stop/"+stop.agency+":"+stop.stop_id;  
		}

		if (Math.random() > 0.5) {
			service_url = alternate_url;
		}

		trArrLog("Loading info for "+stop.agency+" stop "+stop.stop_id+"<br>");
		jQuery.when(jQuery.ajax({
			accepts: "*",
	    type: "GET",
			url: service_url,
			timeout: 2000,
			dataType: "json",
			success: function(data) {
					trStopCache.instance.addToCache(data.agency,data.stop_id,data);
					trArrLog("success<br>");
			},
			error: function(jqXHR, textStatus, errorThrown){
				trArrLog("<font color='red'>error "+dump([jqXHR.status,textStatus])+"</font><br>");
			}				
		})).done(function(data) {
			next_stop = trStopCache().nextUncachedStop(stop_config);
			if (next_stop.agency == undefined) {
				// ran out of stops
				trArrLog("Stop cache built.<br><br>");
				callback(arrivals_object);
			} else {
				// recursively get the next item
				trStopCache().getCacheItem(arrivals_object,stop_config,next_stop,callback);
			}
		}).fail(function(data) {
			next_stop = trStopCache().nextUncachedStop(stop_config);
			if (next_stop.agency == undefined) {
				// ran out of stops
				trArrLog("Stop cache built.<br><br>");
				callback(arrivals_object);
			} else {
				// recursively get the next item
				trStopCache().getCacheItem(arrivals_object,stop_config,next_stop,callback);
			}
		});
	}

	
	this.nextUncachedStop = function(stop_config) {
		for (var agency in stop_config) {
			if (this.cache[agency] == undefined) {
				this.cache[agency] = {};
			}
			for (var stop_id in stop_config[agency]) {
				if (this.cache[agency][stop_id] == undefined) {
					return {agency: agency, stop_id: stop_id};
				}
			}
		}
		return {}; // cache must be complete, no apparent uncached items
	}	
	
	this.stopData = function(agency,stop_id) {
		if (this.cache[agency]) {
			if (this.cache[agency][stop_id]) {
				return this.cache[agency][stop_id];
			} else {
				return undefined;
			}
		} else {
			return undefined;
		}
	}
	

}


