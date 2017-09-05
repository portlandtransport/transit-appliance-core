function trGBFS(options) {
	
	// ensure this is called as constructor
	
	if (!(this instanceof trGBFS)) {
		return new trGBFS(options);
	}
	
	var gbfs_obj = this;
	
	this.address_cache = {};
	this.station_locations = [];
	this.free_locations = [];
	
	this.lat = options.lat * (Math.PI/180);
	this.lng = options.lng * (Math.PI/180);
	this.loc = options.loc;
	this.num_locations = options.num_locations || 2;
	this.include_free_bikes = options.include_free_bikes;
	
	//console.log(gbfs_obj);
	
	// accessor
	this.get_locations = function() {
	  var locations = [];
	  locations = locations.concat(gbfs_obj.station_locations);

	  if (gbfs_obj.include_free_bikes == 1) {
	    locations = locations.concat(gbfs_obj.free_locations);
	  }
	  
	  locations.sort(function(a, b) {
    	return a.distance - b.distance;
		});
		
		var first_station = locations.length-1;
		// want to make sure we include a station in our list, find first station
		for (var i = 0; i < locations.length; i++) {
		  if (locations[i].location_type == "station") {
		    first_station = i;
		    break;
		  }
		}
		
		//console.log("First station index: "+first_station);
		
		if (first_station+1 > this.num_locations) {
		  // remove entries until station included
		  var last_index = this.num_locations - 1;
		  while (locations[last_index].location_type != "station") {
		    locations.splice(last_index, 1);
		  }
		}
		
		//console.table(locations);
	  
		if (locations.length > this.num_locations) {
			locations.length = this.num_locations; // truncate spares before returning
		}
		return locations;
	}
	
	this.cache_size = function() {
    
    var count2 = 0;
    for (var lat in gbfs_obj.address_cache) {
    	for (var lng in gbfs_obj.address_cache[lat]) {
    		++count2;
    	}
    }

    return count2;
	}
	
	this.flush_cache = function() {
    var count = 0;
    
    var now = new Date();
    
    for (var lat in gbfs_obj.address_cache) {
    	var lat_count = 0;
    	if (gbfs_obj.address_cache.hasOwnProperty(lat)) {
	    	for (var lng in gbfs_obj.address_cache[lat]) {
	    		if (gbfs_obj.address_cache[lat].hasOwnProperty(lng)) {
		    		if ((now - gbfs_obj.address_cache[lat][lng].accessed) > 20*60*1000) {
		    			// remove anything not accessed in 20 min
		    			delete gbfs_obj.address_cache[lat][lng];
			    	}
			    }
		    }
		    if (gbfs_obj.address_cache[lat].length == 0) {
		    	delete gbfs_obj.address_cache[lat]
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
					locations.push({ "station_id": gbfs_obj.stations[i].station_id, "distance": gbfs_obj.stations[i].distance, "formatted_distance": gbfs_obj.format_distance(gbfs_obj.stations[i].distance), "name": gbfs_obj.stations[i].name, "num_bikes_available": status.num_bikes_available, "last_reported": status.last_reported, "location_type": "station" });
				}
			}
		}
		//console.table(locations);
		gbfs_obj.station_locations = locations;
	}
	
	this.free_bike_status = function(data) {
	  var locations = [];
		var free_bikes = [];
		for (var i = 0; i < data.data.bikes.length; i++) {
		  if (data.data.bikes[i].is_reserved == 0 && data.data.bikes[i].is_disabled == 0) {
  		  data.data.bikes[i].distance = gbfs_obj.distance([data.data.bikes[i].lon,data.data.bikes[i].lat]);
  		  data.data.bikes[i].formatted_distance = gbfs_obj.format_distance(data.data.bikes[i].distance);
  		  data.data.bikes[i].num_bikes_available = 1;
  		  free_bikes.push(data.data.bikes[i]);;
  		}
		}
		
	  free_bikes.sort(function(a, b) {
    	return a.distance - b.distance;
		});
		
		if (free_bikes.length > gbfs_obj.num_locations) {
		  free_bikes.length = gbfs_obj.num_locations;
		}
		
		// check addresses
		for (var i = 0; i < free_bikes.length; i++) {
		  if (gbfs_obj.address_cache[free_bikes[i].lat] == undefined || gbfs_obj.address_cache[free_bikes[i].lat][free_bikes[i].lon] == undefined) {
		    jQuery.ajax({
  				url: "http://api.geonames.org/findNearestAddressJSON?lat="+free_bikes[i].lat+"&lng="+free_bikes[i].lon+"&username=transitappliance",
  				context: free_bikes[i],
  				dataType: 'jsonp',
  				success: function(address) {
  				  if (gbfs_obj.address_cache[this.lat] == undefined) {
  				    gbfs_obj.address_cache[this.lat] = {};
  				  }
  				  gbfs_obj.address_cache[this.lat][this.lon] = {};
  				  gbfs_obj.address_cache[this.lat][this.lon].base_address = address.address.streetNumber+" "+address.address.street;
  				}
  			});
      } else {
        //console.log("Address match");
        address = gbfs_obj.address_cache[free_bikes[i].lat][free_bikes[i].lon];
        if (address.intersection_address != undefined) {
          free_bikes[i].address = address.intersection_address;
        } else {
          free_bikes[i].address = address.base_address;
          gbfs_obj.get_intersection(free_bikes[i]);
        }
        free_bikes[i].location_type = 'free';
        free_bikes[i].name = free_bikes[i].address;
        locations.push(free_bikes[i]);
      }
		}
		
		//console.table(locations);
		gbfs_obj.free_locations = locations;
		
	}
	
	this.get_intersection = function(bike) {
  	jQuery.ajax({
			url: "http://api.geonames.org/findNearestIntersectionJSON?lat="+bike.lat+"&lng="+bike.lon+"&username=transitappliance",
			context: bike,
			dataType: 'jsonp',
			success: function(intersection) {
				if (intersection != undefined && intersection.intersection != undefined) {
				  var location = gbfs_obj.address_cache[this.lat][this.lon].base_address;
  		    if (location.indexOf(intersection.intersection.street1) != -1) {
  					// street1 is part of address
  					location = location + " (near "+intersection.intersection.street2+")";
  				} else if (location.indexOf(intersection.intersection.street2) != -1) {
  					location = location + " (near "+intersection.intersection.street1+")";
  				} else {
  					location = location + " ("+intersection.intersection.street1+" and "+intersection.intersection.street2+")";
  				}
				  gbfs_obj.address_cache[this.lat][this.lon].intersection_address = location;
				}
			}
		});
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
    
	  if (gbfs_obj.include_free_bikes == 1) {
    	jQuery.ajax({
    		url: gbfs_obj.feeds_object.free_bike_status,
    		dataType: 'json',
    		cache: false,
    		success: gbfs_obj.free_bike_status,
  		  error: function(XMLHttpRequest, textStatus, errorThrown) {
  		  	/* retry once before we throw an error */
  	    	jQuery.ajax({
  	    		url: gbfs_obj.feeds_object.free_bike_status,
  	    		dataType: 'json',
  		  		cache: false,
  	    		success: gbfs_obj.free_bike_status,
  				  error: function(XMLHttpRequest, textStatus, errorThrown) {
  				  	throw "GB2: error fetching GBFS single bike status";
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
		gbfs_obj.free_bikes =[];
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