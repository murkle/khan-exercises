// Add in the site stylesheet
var link = document.createElement("link");
link.rel = "stylesheet";
link.href = "../khan-exercise.css";
document.documentElement.appendChild( link );

// The list of loaded modules
var modules = (document.documentElement.getAttribute("data-require") || "").split(" ");

// Populate this with modules
var KhanUtil = {};

// Load query string params
var query = queryString();

loadScripts( [ "https://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js",
			   "../utils/mersenne-twister.js" ], function() {
	// Load module dependencies
	loadScripts( jQuery.map( modules, function( name ) {
		return "../utils/" + name + ".js";
	}), function() {
		
		jQuery(function() {
			// Initialize the random number generator
			initRandom();
			
			// Inject the site markup, if it doesn't exist
			injectSite();
			
			// Generate the initial problem when dependencies are done being loaded
			makeProblem();
			
			// Watch for a solution submission
			jQuery("form").submit(function() {
				// Get the solution to the problem
				var solution = jQuery("#solution"),
		
				// Figure out if the response was correct
				isCorrect = solution.is("ul") ?
					solution.find("input:checked").val() === "1" :
					jQuery.trim(solution.val()) === solution.data("solution");
				
				// Verify the solution
				if ( isCorrect ) {
					// Show a congratulations message
					jQuery("#congrats").show();
					
					// Toggle the navigation buttons
					jQuery("#check").hide();
					jQuery("#next").show().focus();
					
					// Otherwise show an error message
				} else {
					jQuery("#solution").select();
					jQuery("#oops").show().delay( 1000 ).fadeOut( 2000 );
				}
				
				return false;
			});
			
			// Watch for when the next button is clicked
			jQuery("#next").click(function() {
				// Erase the old value and hide congrats message
				jQuery("#solution").val( "" );
				jQuery("#congrats").hide();
				
				// Toggle the navigation buttons
				jQuery("#check").show();
				jQuery("#next").blur().hide();
				
				// Wipe out any previous problem
				jQuery("#workarea, #hintsarea").empty();
				
				// Generate a new problem
				makeProblem();
				
				return false;
			});
			
			// Watch for when the "Get a Hint" button is clicked
			jQuery("#gethint").click( showHint );
			
			function showHint() {
				// Show the first not shown hint
				var hint = jQuery("#shown-hints > *:hidden:first")
				
					// Run the main method of any modules
					.runModules()
				
					// Reveal the hint
					.show();
			}
		});
	});
	
	// Pick a random element from a set of elements
	jQuery.fn.getRandom = function() {
		return this.eq( Math.floor( this.length * KhanUtil.random() ) );
	};
	
	// Pick a random element from a set of elements, using weights stored in
	// [data-weight], assuming 1 otherwise
	jQuery.fn.getRandomWeighted = function() {
		var totalWeight = 0;
		var weights = jQuery.map( this, function( elem, i ) {
			var weight = jQuery(elem).data("weight");
			weight = weight !== undefined ? weight : 1;
			totalWeight += weight;
			return weight;
		});
		var index = totalWeight * KhanUtil.random();

		for(var i = 0; i < this.length; i++) {
			if(index < weights[i]) {
				return this.eq( i );
			} else {
				index -= weights[i];
			}
		}
	};

	// See if an element is detached
	jQuery.expr[":"].attached = function( elem ) {
		return jQuery.contains( elem.ownerDocument.documentElement, elem );
	};
	
	// Run the methods provided by a module against some elements
	jQuery.fn.runModules = function( type ) {
		type = type || "";
		
		return this.each(function( i, elem ) {
			elem = jQuery( elem );
			
			// Run the main method of any modules
			jQuery.each( modules, function( i, name ) {
				if ( jQuery.fn[ name + type ] ) {
					elem[ name + type ]();
				}
			});
		});
	};
});

function initRandom() {
	var m = new MersenneTwister( query.seed ?
								 parseFloat(query.seed) :
								 undefined );
	jQuery.extend(KhanUtil, {
		random: function() {
			return m.random();
		},

		/* Shuffle an array using a Fischer-Yates shuffle. */
		shuffle: function(array) {
			array = array.slice(0);

			for(var top = array.length; top > 0; top--) {
				var newEnd = Math.floor(KhanUtil.random() * top);
				var tmp = array[newEnd];
				array[newEnd] = array[top - 1];
				array[top - 1] = tmp;
			}

			return array;
		},

		// pluralization helper.  There are three signatures
		// - plural(NUMBER): return "s" if NUMBER is not 1
		// - plural(NUMBER, singular): 
		//		- if necessary, magically pluralize <singular>
		//		- return "NUMBER word"
		// - plural(NUMBER, singular, plural): 
		//		- return "NUMBER word"
		plural: (function() {
			var pluralizeWord = function(word) {
				// determine if our word is all caps.  If so, we'll need to
				// re-capitalize at the end
				var isUpperCase = (word.toUpperCase() == word);

				if ( /[^aeiou]y/i.test( word ) ) {
					word = word.replace(/y$/i, "ies");
				} else if ( word == "quiz" ) {
					word += "zes";
				} else if ( /[sxz]$/i.test( word ) || /[bcfhjlmnqsvwxyz]h/.test( word ) ) {
					word += "es";
				} else {
					word += "s";
				}

				if ( isUpperCase ) {
					word = word.toUpperCase();
				}
				return word;
			};

			return function(value, arg1, arg2) {
				if ( typeof value === "number" ) {
					var usePlural = (value !== 1);

					// if no extra args, just add "s" (if plural)
					if ( arguments.length === 1 ) {
						return usePlural ? "s" : "";
					}

					if ( usePlural ) {
						arg1 = arg2 || pluralizeWord(arg1);
					}

					return value + " " + arg1;
				} else if ( typeof value === "string" ) {
					return pluralizeWord(value);
				}
			};
		})()
	});
}

function makeProblem() {
	jQuery(".exercise").each(function() {
		var exercise = jQuery(this);
		
		// Run the "Load" method of any modules
		exercise.runModules( "Load" );
		
		// Get the problem we'll be using
		var problems = exercise.find(".problems").children(),
	  		problem;
		
		// Check to see if we want to test a specific problem
		if ( query.problem ) {
			problem = /^\d+$/.test( query.problem ) ?
				// Access a problem by number
				problems.eq( parseFloat( query.problem ) ) :
				
			// Or by its ID
			problems.filter( "#" + query.problem );
			
		} else {
			problem = problems.getRandomWeighted();
		}
		
		// Work with a clone to avoid modifying the original
		problem = problem.clone();
		
		// See if there's an original problem that we're inheriting from
		if ( problem.data("type") ) {
			// Clone it for manipulation
			var original = jQuery("#" + problem.data("type")).clone();
			
			// Go through the components of the sub-problem
			problem.children().each(function() {
				// Remove those parts from the original
				original.children( "." + this.className ).remove();
				// And add our new ones in, instead
				original.append( problem );
			});
			
			problem = original;
		}

		// Run the "Load" method of any modules
		problem.runModules( "Load" );
		
		// Store the solution to the problem
		var solution = problem.find(".solution"),
	  
			// Get the multiple choice problems
			choices = problem.find(".choices").remove();
		
		if ( choices.length ) {
			var radios = [ solution.remove()[0] ],
	   
				// Avoid duplicate responses
				dupes = {},
				dupe = false,

				// Figure out how many choices to show
				num = parseFloat( choices.data("show") ),

				// Go through the possible wrong answers
				possible = choices.children().get();
			
			// Figure out the solution to display
			// If "none" is a possibility, make it a correct answer sometimes
			if ( num && choices.data("none") ) {
				// The right answer is injected most of the time
				radios[ KhanUtil.random() > 1 / num ? 1 : 0 ] = jQuery("<li>None of these.</li>")[0];
			}

			// Remember the solution
			solution = radios[0];
			
			// And add them in in a random order
			// If no max number is specified, add all the options
			while ( possible.length && (!num || radios.length < num) ) {
				var item = possible.splice( Math.floor( possible.length * KhanUtil.random() ), 1 )[0];
				radios.splice( Math.round( radios.length * KhanUtil.random() ), 0, item );
			}
			
			var ul = jQuery("#solution")
				// Clear out the existing solutions
		   		.replaceWith("<ul id='solution'></ul>");
			
			// Insert all the radio buttons
			jQuery( radios ).each(function() {
				jQuery( this ).contents()
					.wrapAll("<li><label><span class='value'></span></label></li>" )
					// TODO: Perhaps make this a bit harder to find to curb cheating?
					.parent().before( "<input type='radio' name='solution' value='" + (this === solution ? 1 : 0) + "'/>" )
					.parent().parent()
					.appendTo("#solution");
			});
			
			jQuery("#solution")
				// Run the main method of any modules
				.runModules()
			
				// Grab all the possible choices
				.find("label > span").each(function() {
					var value = jQuery(this).text();
					
					// Is a duplicate value found?
					if ( dupes[ value ] ) {
						dupe = true;
					}
					
					// Remember the value for later
					dupes[ value ] = true;
				});
			
			// Duplicate found
			if ( dupe ) {
				// Generate a different problem
				// TODO: Make sure this doesn't recurse too many times
				return makeProblem();
			}
		}
		
		// Run the main method of any modules
		problem.runModules();
		
		// Otherwise we're dealing with a text input
		if ( !choices.length ) {
			jQuery("#solution").data( "solution", jQuery.trim(solution.text()) );
			
			// Remove solution from display
			solution.remove();
		}
		
		// Add the problem into the page
		jQuery("#workarea").append( problem );
		
		// Focus the solution textbox
		jQuery("#solution:not(:focus)").focus();

		// Clone the hints and add them into their area
		var hints = exercise.children(".hints").clone();
		
		// Extract any problem-specific hints
		problem.find(".hints").remove().children().each(function() {
			// Replace the hint placeholders
			hints.find("." + this.className).replaceWith( this );
		});
		
		hints
			// Hide all the hints
			.children().hide().end()
		
			// And give it a new ID
			.attr("id", "shown-hints")
			
			// Run the "Load" method of any modules
			.runModules( "Load" )
		
			// Add it in to the page
			.appendTo("#hintsarea");
	});
}

function injectSite() {
	jQuery("body").prepend(
		'<h1>' + document.title + '</h1>' +
		'<div id="sidebar">' +
			'<form action="">' +
				'<h3>Answer</h3>' +
				'<input type="text" id="solution"/>' +
				'<input type="submit" id="check" value="Check Answer"/>' +
				'<p id="congrats">Congratulations! That answer is correct.</p>' +
				'<p id="oops">Oops! That answer is not correct, please try again.</p>' +
				'<input type="button" id="next" value="Next Problem"/>' +
			'</form>' +
			'<div id="help">' +
				'<h3>Need Help?</h3>' +
				'<input type="button" id="gethint" value="Get a Hint"/>' +
			'</div>' +
		'</div>' +
		'<div id="workarea"></div>' +
		'<div id="hintsarea"></div>'
	);
}

function loadScripts( urls, callback ) {
	var loaded = 0,
	 loading = urls.length;
	
	// Ehhh... not a huge fan of this
	this.scriptWait = function( callback ) {
		loading++;
		callback( runCallback );
	};

	for ( var i = 0; i < loading; i++ ) (function( url ) {
		var script = document.createElement("script");
		script.src = url;
		script.onload = runCallback;
		document.documentElement.appendChild( script );
	})( urls[i] );

	runCallback( true );
	
	function runCallback( check ) {
		if ( check !== true ) {
			loaded++;
		}
		
		if ( callback && loading === loaded ) {
			callback();
		}
	}
}

// Original from:
// http://stackoverflow.com/questions/901115/get-querystring-values-in-javascript/2880929#2880929
function queryString() {
	var urlParams = {},
	 e,
	 a = /\+/g,  // Regex for replacing addition symbol with a space
	 r = /([^&=]+)=?([^&]*)/g,
	 d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
	 q = window.location.search.substring(1);

	while ( (e = r.exec(q)) ) {
		urlParams[d(e[1])] = d(e[2]);
	}
	
	return urlParams;
}
