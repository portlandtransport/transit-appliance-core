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

function trAgencyCache() {
	
	// ensure this is called as constructor
	
	if (!(this instanceof trAgencyCache)) {
		return new trAgencyCache();
	}
	
	// make this a singleton
	
	if (typeof trAgencyCache.instance === "object") {
		return trAgencyCache.instance;
	}
	
	trAgencyCache.instance = this;
	
	this.cache = {}; // our cache element
	
	// precache most popular items
	this.cache['TriMet'] = {
        "rights_notice": "Route and arrival data provided by permission of TriMet.",
        "_id": "TriMet",
        "agency_name": "TriMet",
        "agency_url": "http://trimet.org",
        "agency_timezone": "America/Los_Angeles",
        "avl_agency_id": "portland-sc",
        "doc_type": "Document",
        "avl_service": "TriMet",
        "agency_lang": "en"
	};
	
	this.cache['PCC'] = {
        "rights_notice": "",
        "_id": "PCC",
        "agency_name": "PCC",
        "agency_url": "http://www.pcc.edu/resources/parking/shuttle/",
        "agency_timezone": "America/Los_Angeles",
        "avl_agency_id": "PCC",
        "doc_type": "Document",
        "avl_service": "PCC",
        "agency_lang": "en"
	};
	
	this.addToCache = function(agency,data) {
		this.cache[agency] = data;
	}
	
  	
	this.checkCached = function(arrivals_object,stop_config,callback) {
		// initialize recursive retrieval of cache items
		var next_agency = this.nextUncachedAgency(stop_config);
		this.getCacheItem(arrivals_object,stop_config,next_agency,callback);
    
	}
	
	this.getCacheItem = function(arrivals_object,stop_config,agency,callback) {
		
		//this.cache[agency] = false;
		// get the stop info
		var service_url = "http://agencies.transitappliance.com/agencies_production/"+agency;
		var alternate_url = "http://agencies1.transitappliance.com/agency/"+agency;
		if (Math.random() > 0.5) {
			service_url = alternate_url;
		}

        if (trAgencyCache().nextUncachedAgency(stop_config) !== undefined) {
    		trArrLog("Loading info for "+agency+"<br>");
    		jQuery.when(jQuery.ajax({
    	    type: "GET",
    			url: service_url,
    			timeout: 2000,
    			dataType: "json",
    			success: function(data) {
    				trAgencyCache.instance.addToCache(agency,data);
    				trArrLog("success<br>");
    			},
    			error: function(jqXHR, textStatus, errorThrown){
    				trArrLog("<font color='red'>error</font><br>");
    			}				
    		})).done(function(data) {
    			next_agency = trAgencyCache().nextUncachedAgency(stop_config);
    			if (next_agency == undefined) {
    				// ran out of stops
    				trArrLog("Agency cache built.<br><br>");
    				callback(arrivals_object);
    			} else {
    				// recursively get the next item
    				trAgencyCache().getCacheItem(arrivals_object,stop_config,next_agency,callback);
    			}
    		}).fail(function(data) {
    			next_agency = trAgencyCache().nextUncachedAgency(stop_config);
    			if (next_agency == undefined) {
    				// ran out of stops
    				trArrLog("Agency cache built.<br><br>");
    				callback(arrivals_object);
    			} else {
    				// recursively get the next item
    				trAgencyCache().getCacheItem(arrivals_object,stop_config,next_agency,callback);
    			}
    		});
    	} else {
    	    trArrLog("Relying on pre-cached agencies.<br><br>");
    	    callback(arrivals_object);
    	}

	}

	
	this.nextUncachedAgency = function(stop_config) {
		for (var agency in stop_config) {
			if (this.cache[agency] == undefined) {
				return agency
			}
		}
		return undefined; // cache must be complete, no apparent uncached items
	}	
	
	this.agencyData = function(agency) {
		if (this.cache[agency]) {
			return this.cache[agency];
		} else {
			return undefined;
		}
	}
	

}


