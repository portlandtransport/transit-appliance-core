function trGBFS(options) {
	
	// ensure this is called as constructor
	
	if (!(this instanceof trGBFS)) {
		return new trGBFS(options);
	}
	
	var gbfs_obj = this;
	
	this.intersection_cache = {};
	this.locations = [];
	this.cache_miss_count = 0;
	this.no_cross_street_count = 0;
	
	this.lat = options.lat * (Math.PI/180);
	this.lng = options.lng * (Math.PI/180);
	this.loc = options.loc;
	this.num_locations = options.num_locations || 2;
	
	//console.log(gbfs_obj);
	
	// accessor
	this.get_locations = function() {
		if (gbfs_obj.locations.length > this.num_locations) {
			gbfs_obj.locations.length = this.num_locations; // truncate spares before returning
		}
		return gbfs_obj.locations;
	}
	
	this.get_cache_miss_count = function() {
		return gbfs_obj.cache_miss_count;
	}
	
	this.get_no_cross_street_count = function() {
		return gbfs_obj.no_cross_street_count;
	}
	
	this.cache_size = function() {
    
    var count2 = 0;
    for (var lat in gbfs_obj.intersection_cache) {
    	for (var lng in gbfs_obj.intersection_cache[lat]) {
    		++count2;
    	}
    }

    return count2;
	}
	
	this.flush_cache = function() {
    var count = 0;
    
    var now = new Date();
    
    for (var lat in gbfs_obj.intersection_cache) {
    	var lat_count = 0;
    	if (gbfs_obj.intersection_cache.hasOwnProperty(lat)) {
	    	for (var lng in gbfs_obj.intersection_cache[lat]) {
	    		if (gbfs_obj.intersection_cache[lat].hasOwnProperty(lng)) {
		    		if ((now - gbfs_obj.intersection_cache[lat][lng].accessed) > 20*60*1000) {
		    			// remove anything not accessed in 20 min
		    			delete gbfs_obj.intersection_cache[lat][lng];
			    	}
			    }
		    }
		    if (gbfs_obj.intersection_cache[lat].length == 0) {
		    	delete gbfs_obj.intersection_cache[lat]
		    }
		  }
    }				
	}
	
	// utility functions
	
	this.format_street = function (address) {
		var fields = address.split(/,/); // separate street address
		fields = fields[0].split(/\s+/);
		fields.unshift(fields.pop());
		address = fields.join(" ");
		return address.replace(" Nw "," NW ").replace(" Sw "," SW ").replace(" Se "," SE ").replace(" Ne "," NE ");
	}
	
	this.format_distance = function(distance) {
		return distance.toFixed(1)+" mi";
	}
	
	this.distance = function(coordinates) {
		var R = 3959; // mi (6371 km)     			
				
		var lng2 = coordinates[0] * (Math.PI/180);
		var lat2 = coordinates[1] * (Math.PI/180);
		
		/*	
		var x = (lng2-lng1) * Math.cos((lat1+lat2)/2);
		var y = (lat2-lat1);
		var d = Math.sqrt(x*x + y*y) * R;
		*/

		
		var dLat = (lat2-gbfs_obj.lat);
		var dLng = (lng2-gbfs_obj.lng);
		
		var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		        Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(gbfs_obj.lat) * Math.cos(lat2); 
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
		return R * c;
		
	}
	
	this.station_status = function(data) {
		var status_obj = {};
		for (var i = 0; i < data.data.stations.length; i++) {
			status_obj[data.data.stations[i].station_id] = data.data.stations[i];
		}
		
		// console.table(status_obj);
		
		var locations = [];
		for (var i = 0; i < gbfs_obj.stations.length; i++) {
			var status = status_obj[gbfs_obj.stations[i].station_id];
			if (typeof status === 'object') {
				if (status.num_bikes_available > 0 && status.is_renting == 1) {
					locations.push({ "station_id": gbfs_obj.stations[i].station_id, "distance": gbfs_obj.stations[i].distance, "formatted_distance": gbfs_obj.format_distance(gbfs_obj.stations[i].distance), "name": gbfs_obj.stations[i].name, "num_bikes_available": status.num_bikes_available, "last_reported": status.last_reported });
				}
			}
		}
		//console.table(locations);
		gbfs_obj.locations = locations;
	}
	
	this.update_locations = function() {
		gbfs_obj.flush_cache();

		if (typeof gbfs_obj.feeds_object === "object" && gbfs_obj.feeds_object.station_status) {
    	jQuery.ajax({
    		url: gbfs_obj.feeds_object.station_status,
    		dataType: 'json',
	  		cache: false,
    		success: gbfs_obj.station_status,
			  error: function(XMLHttpRequest, textStatus, errorThrown) {
			  	/* retry once before we throw an error */
		    	jQuery.ajax({
		    		url: gbfs_obj.feeds_object.station_status,
		    		dataType: 'json',
			  		cache: false,
		    		success: gbfs_obj.station_status,
					  error: function(XMLHttpRequest, textStatus, errorThrown) {
					  	throw "GB1: error fetching GBFS station status";
					  }
		    	});
			  }
    	});
    }

		
	}
	
	/* initializations */
	
	this.gbfs_feed = "http://biketownpdx.socialbicycles.com/opendata/gbfs.json";
	this.gbfs_feed_retry_period = 5*60*1000; // start at 5 minutes, double on each retry
	
	
	function initialize_feeds() {
		jQuery.ajax({
			url: gbfs_obj.gbfs_feed,
			dataType: 'json',
			cache: false,
			success: initialize_gbfs,
		  error: function(XMLHttpRequest, textStatus, errorThrown) {
				// console.log("unable to get GBFS feeds: "+this.gbfs_feed);
				retry_initialization();
		  }
		});
	}
	
	function retry_initialization() {
		//console.log(gbfs_obj.gbfs_feed_retry_period);
		setTimeout(initialize_feeds, gbfs_obj.gbfs_feed_retry_period);
		gbfs_obj.gbfs_feed_retry_period = gbfs_obj.gbfs_feed_retry_period * 2; // double retry period on each subsequent retry
	}
	
	initialize_feeds();
		
	function initialize_gbfs(data) {
		gbfs_obj.feeds_object = {};
		var feeds_array = data.data.en.feeds;
	  for (var i = 0; i < feeds_array.length; i++) {
			gbfs_obj.feeds_object[feeds_array[i].name] = feeds_array[i].url;
		}
		
		if (gbfs_obj.feeds_object.station_information) {
    	jQuery.ajax({
    		url: gbfs_obj.feeds_object.station_information,
    		dataType: 'json',
	  		cache: false,
    		success: initialize_stations,
			  error: function(XMLHttpRequest, textStatus, errorThrown) {
			  	// console.log("error fetching GBFS station information: "+feeds_object.station_information);
			  	retry_initialization();
			  }
    	});
    }
			
		
		//console.log(feeds_object);
	}
	
	function initialize_stations(data) {
		gbfs_obj.stations = data.data.stations;
	  for (var i = 0; i < gbfs_obj.stations.length; i++) {
			gbfs_obj.stations[i].distance = gbfs_obj.distance([gbfs_obj.stations[i].lon,gbfs_obj.stations[i].lat]);
		}
		
		gbfs_obj.stations.sort(function(a, b) {
    	return a.distance - b.distance;
		});
		//console.table(gbfs_obj.stations);
		
		// now start updating loop
		
		gbfs_obj.update_locations();
	
		setInterval(function() {gbfs_obj.update_locations()}, 60*1000); // update every minute
	}


	
}		