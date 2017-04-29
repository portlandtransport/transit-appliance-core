			function trCar2Go(options) {
				
				// ensure this is called as constructor
				
				if (!(this instanceof trCar2Go)) {
					return new trCar2Go(options);
				}
				
				var c2g_obj = this;
				
				this.intersection_cache = {};
				this.vehicles = [];
				this.cache_miss_count = 0;
				this.no_cross_street_count = 0;
				
				this.lat = options.lat * (Math.PI/180);
				this.lng = options.lng * (Math.PI/180);
				this.loc = options.loc;
				this.num_vehicles = options.num_vehicles || 2;
				this.consumer_key = options.consumer_key;
				
				// accessor
				this.get_vehicles = function() {
					c2g_obj.vehicles.length = this.num_vehicles; // truncate spares before returning
					return c2g_obj.vehicles;
				}
				
				this.get_cache_miss_count = function() {
					return c2g_obj.cache_miss_count;
				}
				
				this.get_no_cross_street_count = function() {
					return c2g_obj.no_cross_street_count;
				}
				
				this.cache_size = function() {
			    
			    var count2 = 0;
			    for (var lat in c2g_obj.intersection_cache) {
			    	for (var lng in c2g_obj.intersection_cache[lat]) {
			    		++count2;
			    	}
			    }
			
			    return count2;
				}
				
				this.flush_cache = function() {
			    var count = 0;
			    
			    var now = new Date();
			    
			    for (var lat in c2g_obj.intersection_cache) {
			    	var lat_count = 0;
			    	if (c2g_obj.intersection_cache.hasOwnProperty(lat)) {
				    	for (var lng in c2g_obj.intersection_cache[lat]) {
				    		if (c2g_obj.intersection_cache[lat].hasOwnProperty(lng)) {
					    		if ((now - c2g_obj.intersection_cache[lat][lng].accessed) > 20*60*1000) {
					    			// remove anything not accessed in 20 min
					    			delete c2g_obj.intersection_cache[lat][lng];
						    	}
						    }
					    }
					    if (c2g_obj.intersection_cache[lat].length == 0) {
					    	delete c2g_obj.intersection_cache[lat]
					    }
					  }
			    }				
				}
				
				// utility functions
				
				this.format_street = function (address) {
					var fields = address.split(/,/); // separate street address
					/* Car2Go changed address format Sept 2016
					fields = fields[0].split(/\s+/);
					fields.unshift(fields.pop());
					address = fields.join(" ");
					*/
					address = fields[0];
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

					
					var dLat = (lat2-c2g_obj.lat);
					var dLng = (lng2-c2g_obj.lng);
					
					var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
					        Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(c2g_obj.lat) * Math.cos(lat2); 
					var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
					return R * c;
					
				}
				
				this.update_vehicles = function() {
					c2g_obj.flush_cache();
					//debug_alert(c2g_obj.intersection_cache);
					
					var car2go_url = "https://www.car2go.com/api/v2.1/vehicles?loc="+this.loc+"&oauth_consumer_key="+this.consumer_key+"&format=json";
					car2go_url = "https://a4nnfp090l.execute-api.us-east-1.amazonaws.com/prod/transitboard_c2gproxy";
					var callback = "vehicles";
					
					if (location.search.match("car2goproxy") !== null) {
						car2go_url = "http://transitappliance.com/cgi-bin/car2go_proxy.pl?loc="+this.loc+"&oauth_consumer_key="+this.consumer_key+"&format=json";
						callback = (function () { return; })(); // set undefined
					}
					
		      jQuery.ajax({
		      	url: car2go_url,
		      	dataType: 'jsonp',
		      	jsonpCallback: callback,
		      	error: function(XMLHttpRequest, textStatus, errorThrown) {
					  	throw "C2G1: error fetching Car2Go vehicles";
					  	c2g_obj.vehicles = []; // clear vehicle list
					  },
		      	success: function(data) {
		      		if (typeof data === "undefined" || typeof data.placemarks === "undefined") {
		      			throw "C2G2: missing data while fetching Car2Go vehicles";
		      			c2g_obj.vehicles = []; // clear vehicle list
		      			return;
		      		}
		      		var distances = [];
		      		jQuery.each(data.placemarks, function(index,value) {	
								distances.push([ c2g_obj.distance(data.placemarks[index].coordinates), index ]);
		      		});
		      		
		      		// sort by distance
		      		distances.sort(function(a, b) { return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0 });
		      		
		      		var collection = [];
		      		collection.length = c2g_obj.num_vehicles*1+2; // have a couple waiting in reserve in case cars leave
		      		
		      		// make sure we're not asking for more data than exists (distances may have no elements during a car2go service outage)
		      		if (collection.length > distances.length) {
		      			collection.length = distances.length;
		      		}
		      		
		      		c2g_obj.vehicles = []; // clear vehicle list
		      		
		      		jQuery.each(collection, function(index) {
		      			// update the tuple, using the default string
		      			var lat = data.placemarks[distances[index][1]].coordinates[1];
		      			var lng = data.placemarks[distances[index][1]].coordinates[0]; 
		      			
		      			var location = c2g_obj.format_street(data.placemarks[distances[index][1]].address);
		      			if (c2g_obj.intersection_cache[lat] != undefined && c2g_obj.intersection_cache[lat][lng] != undefined) {
		      				if (location.indexOf(c2g_obj.intersection_cache[lat][lng].street1) != -1) {
		      					// street1 is part of address
		      					location = location + " (near "+c2g_obj.intersection_cache[lat][lng].street2+")";
		      				} else if (location.indexOf(c2g_obj.intersection_cache[lat][lng].street2) != -1) {
		      					location = location + " (near "+c2g_obj.intersection_cache[lat][lng].street1+")";
		      				} else {
		      					location = location + " ("+c2g_obj.intersection_cache[lat][lng].street1+" and "+c2g_obj.intersection_cache[lat][lng].street2+")";
		      					++c2g_obj.no_cross_street_count;
		      				}
		      				c2g_obj.intersection_cache[lat][lng].accessed = new Date(); // update timestamp
		      			} else {
		      				c2g_obj.cache_miss_count++;
		      				// populate intersection cache
			      			jQuery.ajax({
			      				url: "http://api.geonames.org/findNearestIntersectionJSON?lat="+data.placemarks[distances[index][1]].coordinates[1]+"&lng="+data.placemarks[distances[index][1]].coordinates[0]+"&username=transitappliance",
			      				dataType: 'jsonp',
			      				success: function(intersection) {
			      					if (intersection != undefined && intersection.intersection != undefined) {
				      					if (c2g_obj.intersection_cache[data.placemarks[distances[index][1]].coordinates[1]] == undefined) {
				      						c2g_obj.intersection_cache[data.placemarks[distances[index][1]].coordinates[1]] = {};
				      					}
				      					c2g_obj.intersection_cache[data.placemarks[distances[index][1]].coordinates[1]][data.placemarks[distances[index][1]].coordinates[0]] = {street1: intersection.intersection.street1, street2: intersection.intersection.street2, accessed: new Date()};
											}
			      				}
			      			});
			      		}
		      				
		      			c2g_obj.vehicles.push([location, distances[index][0]]);

						  });		
		      	}
					});
				}

				c2g_obj.update_vehicles();
				
				setInterval(function() {c2g_obj.update_vehicles()}, 60*1000); // update every minute
				
			}		