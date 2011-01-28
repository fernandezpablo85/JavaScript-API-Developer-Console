/**
 * Provides application functionality for JavaScript API Developer Console test environment
 * @author      Eugene ONeill (eoneill)
 * @maintainer  Eugene ONeill (eoneill)
 * @requires    jQuery (http://jquery.com/),
 *              jQuery UI (http://jqueryui.com/),
 *              jQuery Cookie Plugin (https://github.com/carhartl/jquery-cookie),
 *              CodeMirror (http://codemirror.net/),
 **/

// set up console for logging
if (!window.console || !window.console.log) {
  window.console = window.console || {};
  window.console.log = window.console.log || function(){};
}

// ----------------------------------------------------------------------------------------------------
// ...
// ----------------------------------------------------------------------------------------------------
;(function($, undefined) { // protect script, preserve jQuery $ alias, and don't trust global undefined

// custom jQuery pulse effect
$.fn.pulse = function(settings){
	settings = $.extend({
		duration: "medium",
		fadeTo: 0.7
	}, settings);
	this.each(function(){
		$(this).fadeTo(settings.duration,settings.fadeTo)
			.fadeTo(settings.duration,1)
			.fadeTo(settings.duration,settings.fadeTo)
			.fadeTo(settings.duration,1)
			.click(function(){
				$(this).stop().fadeTo(1,1);
			});
	});
	return this;
};

// ----------------------------------------------------------------------------------------------------
// wait until on DOMReady event
//  not entirely necessary as we are loading the script at the end of the document already,
//  but better safe than sorry
// ----------------------------------------------------------------------------------------------------
$(function() {
//  Some constants
var MIN_CONTAINER_HEIGHT = 300; //minimum height that a container should be (in px) 
var EXPAND_HEIGHT = 100;        // height to expand the result bar
var BITLY_USER = "eoneill";     // Bit.ly API settings
var BITLY_KEY = "R_4f1d96e89bee1a8d88edb114dd0c1e4b";
var CONNECT_API_KEY = "up8hQML83EYXioHsDsw4ktyShFAoNwJzhY8WDmJPZWdqRVzaIvw9r0phLieHH_c5"; // LinkedIn API Key
var PROD_OPTIONS = { authorize:false, credentials_cookie:false, api_key:false }; // Default, enforced, options for Production framework

/*
 * cache some DOM elements
 *  these are some frequently used DOM elements, it is helpful to
 *  cache these to prevent multiple DOM look-ups
 *  (not entirely necessary as Sizzle will cache most of these)
 *  - variables prefixed with $ are jQuery Objects
 */
var $accordion = $("#sidebar-accordion");
var $sandbox = $("#sandbox");
var $codeConsole =$("#code-console");
var $contractSandbox = $("#contract-sandbox");
var $errorContainer = $("#error-container");
var $tinyURLContainer = $("#tiny-url-container");
var $tinyURL = $("#tiny-url");
var loc = window.location;
// these DOM elements won't be available until ajax completes,
// we could use live(), but we we'll just wait until the ajax request finishes
var $frameworkSelector;
var $frameworkCustom;
var $frameworkCustomURL;
var $apiOptions;
var $apiKey;

// a few global-esque vars */
var originalCode = "";  // used to compare if code changes occured
var saved = {};         // use this to hold cookies/preferences
var tinyURLs = [];      // URLs generated by bit.ly (reduce server hits)

// create CodeMirror editor */
var consoleEditor = CodeMirror.fromTextArea("code-console", {
  height    : "350px",
  parserfile: ["parsexml.js", "parsecss.js", "tokenizejavascript.js", "parsejavascript.js", "parsehtmlmixed.js"],
  stylesheet: ["css/codemirror/xmlcolors.css", "css/codemirror/jscolors.css", "css/codemirror/csscolors.css"],
  path      : "js/codemirror/"
});
var $codeMirror = $(".CodeMirror-wrapping", "#console-container");


/**
 * helper function to reset the environment
 *  this helps ensure that subsequent runs will work properly
 * @method  tryLoadExample
 */
var tryLoadExample = function(){
  try {
    consoleEditor.getCode();
    loadExample( getExampleFromHash() );
  }
  catch(e) {
    setTimeout(tryLoadExample, 20);
  }
}


/**
 * helper function to clean up passed in options
 *  this helps enforce restrictions and correctness of parameters
 * @method  parseOptions
 * @param   {Boolean} allowBadOnLoad should onLoad not be verified? (true when Run is executed)
 */
var parseOptions = function( allowBadOnLoad ) {
  var options = $apiOptions.val();
  var newOptions = "";
  var processed = [];
  
  if( saved.extendapioptions ) {
    // append extended options
    options = options + "\n" + saved.extendapioptions;
  }
  
  if( options !== "" ) {
    var code = "";
    if(options.search("onLoad") !== -1){
      code = consoleEditor.getCode();
    }
    options = options.split("\n");
    $.each( options, function(key, value) {
      if( value !== "" ) {
        var temp = value.replace(/\s+/g,"").split(":"); // removes whitespace and splits into key:value pairs
        var skip = false;
        /*
         * These rules might be a bit confusing, priority matters
         *  (1) if a parameter has already been included, don't include it again
         *      - we don't want duplicate parameters
         *  (2) user parameters should take precedence over example specific parameters
         *      - the exception is when an onLoad parameter is defined, but the onLoad function
         *       is not defined within the code body
         *       (this will prevent errors while switching between examples that override onLoad)
         *      - this exception is ignored when
         *  (3) if no value was set for the parameter, drop it
         *  (4) if the user selected the Production framework, enforce some default values
         *      - authorize: false
         *      - credentials_cookie: false
         */
        if( processed[ temp[0] ] !== undefined ) {            // rule(1)
          skip = true;
        }
        else if( temp[0] === "onLoad" ) {                     // exception for rule(2)
          // be nice, clean up unused onLoad params
          processed[temp[0]] = true;
          if( !allowBadOnLoad && code !== "") {
            var onload = "";
            temp[1] = temp[1].split(",");
            $.each(temp[1], function(i, val) {
              if(val !== "") {
                if( code.search(val) === -1 ) {
                  throwErrorMessage("badonload", "an unused onLoad event '"+val+"' was removed from the parameters", "highlight");
                }
                else {
                  onload += val+",";
                }
              }
            });
            if(onload === "") {
              skip = true;
              processed[temp[0]] = false;
            }
            else {
              temp[1] = onload.slice(0,-1); // remove last comma
              skip = false;
            }
          }
        }
        else if( temp[1] === "" || temp[1] === undefined) {    // rule(3) no paramter value set
          skip = true;
        }
        else if( $frameworkSelector.val() !== "custom" ) {    // rule(4)
          // using production framework, apply overrides
          if( PROD_OPTIONS[ temp[0] ] !== undefined ) {
            processed[temp[0]] = true;
            skip = true;
          }
        }
        else {
          processed[temp[0]] = true;
        }
        
        if( !skip ) {
          newOptions += temp[0] + ": " + temp[1] + "\n";
        }
      }
    });
  }
  $apiOptions.val( newOptions );
};


/**
 * helper function to reset the environment
 *  this helps ensure that subsequent runs will work properly
 * @method  cleanUpEnvironment
 * @param   {Boolean} hideTinyURL trigger hiding of the generated URL
 */
var cleanUpEnvironment = function( dontHideTinyURL ) {
  // remove generated sandbox
  $("iframe","#sandbox").remove();

  if( !dontHideTinyURL ) {
    // hide previous TinyURL
    $tinyURLContainer.hide("fast");
  }
  else {
    $tinyURLContainer.pulse( {duration: "fast"} );
  }
  // remove previous error messages
  removeAllErrorMessages();
};


/**
 * helper function to execute the request
 * @method  executeCode
 */
var executeCode = function() {
  parseOptions( true );   // ensure that option rules are enforced
  
  var doTinyURL;
  var connectURL = $frameworkSelector.val();
  var apiOptions = $apiOptions.val();
  var apiKey = $apiKey.val();
  // store preferences in JSON formatted string
  var preferences = '{'
        +'"framework":"'+$frameworkSelector.val()+'",'
        +'"frameworkurl":"'+$frameworkCustomURL.val()+'",'
        +'"apikey":"'+apiKey+'",'
        +'"apioptions":"'+apiOptions.replace(/\n/g,"\\n")+'"' // we need to escape newlines for valid JSON
      +'}';
  if(connectURL !== "custom") {
    apiKey = CONNECT_API_KEY;
  }
  var params = "api_key: "+apiKey+"\n"+apiOptions;
  var runCode = consoleEditor.getCode();
  var exampleData = getExampleFromHash();

  // save settings to cookie (as JSON)
  $.cookie( "apiconsole", preferences, { path: '/', expires: 365 } );

  if(runCode != originalCode) {
    exampleData = "c="+escape(runCode);
  }
  loc.hash = "#" + exampleData + "&" + preferences;
  
  doTinyURL = tinyURLs[loc.href];
  
  cleanUpEnvironment( doTinyURL !== undefined );

  // generate a TinyURL
  if(doTinyURL === undefined) {
    getTinyURL(loc.href, function(tinyurl){
      $tinyURL.text(tinyurl).attr("href",tinyurl);
      $tinyURLContainer.show("fast");
      tinyURLs[loc.href] = tinyurl;
    });
  }
  else {
    $tinyURL.text(doTinyURL).attr("href",doTinyURL);
  }

  // was a custom URL provided?
  if(connectURL === "custom") {
    connectURL = $frameworkCustomURL.val();
    if(connectURL === "") {
      connectURL = $("option", $frameworkSelector).first().val();
    }
  }

  // build the sandbox iframe
  try {
    // set a window function that will give us the HTML for the sandbox
    // it gets overwritten on each run
    window.getSandboxHtml = function getSandboxHtml() {
      return ['',
              '<scr'+'ipt type="text/javascript" src="'+connectURL+'">',
              params,
              '</scr'+'ipt>',
              runCode,
              '']
              .join("\n");
    };
    // append sandbox iframe
    // the sandbox will actually run the code
    $sandbox.append('<iframe id="sandboxrunner" src="sandbox.html">');
  }
  catch(e) {
    throwErrorMessage("error1003","Failed to inject Framework\n"+e);
  }
};


/**
 * helper function to toggle custom url input field
 * @method  toggleCustomURL
 * @param   {String | Number} animationSpeed a valid jQuery animation speed (optional)
 */
var toggleCustomURL = function( animationSpeed ) {
  if( $frameworkSelector.val() !== "custom" ) {
    $frameworkCustom.hide( animationSpeed );
  }
  else {
    $frameworkCustom.show( animationSpeed );
  }
};


/**
 * helper function to return the portion of the hash before an &
 * - this will be the "example" file to load into the console
 * @method  getExampleFromHash
 */
var getExampleFromHash = function() {
  var example;
  if( loc.hash ) {
    example = loc.hash.replace("#","");
    if( example !== "" ) {
      example = example.split("&");
      return example[0];
    }
  }
  return "";
};


/**
 * helper function to load example file via ajax
 * @method  loadExample
 * @param   {String} loadData data to be parsed
 */
var loadExample = function( loadData ) {
  if( loadData !== "" && loadData !== "#" && 
      loadData !== undefined && loadData !== "undefined" )
  {
    saved.extendapioptions = undefined;
    
    loadData = loadData.split("&");
    exampleURL = loadData[0];
    if(loadData.length > 1) {
      try {
        loadData = $.parseJSON( unescape(loadData[1]) );  // need to unescape the hash
        if(loadData.extendapioptions) {
          saved.extendapioptions = loadData.extendapioptions;
        }
        restorePreferences(loadData); // replace options form with hash prefs
      }
      catch(e) {
        throwErrorMessage("error1002","the URL is malformed. Could not retreive preferences.");
      }
    }
    // set a message in the console
    consoleEditor.setCode("loading example...");
	  removeErrorMessage("error1000");
	  removeErrorMessage("badonload");

    if( exampleURL.search("c=") === -1 ) { // no custom code was provided
      if( exampleURL.match(/(https?|ftp):\/\/.+/) ) {
        // a full URL was provided, we pull down the file using CSV via YQL
        exampleURL = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20csv%20where%20url%3D%22"+encodeURIComponent(exampleURL)+"%22&format=json&callback="
        $.getJSON(exampleURL, function(data){
          if(data.query.count !== "0") {
            // now that we have the CSV returned as JSON, we need
            // to parse it and recombine the rows and columns
            var rows = data.query.results.row;    // rows of data
            var result = "";
            $.each(rows, function(k, cols){       // loop through each row and append a newline \n
              var row = "";
              $.each(cols, function(key, value){    // loop through each column and prepend a comma
                value = value || "";    // takes care of the case when value === null (an empty line)
                row += (key === "col0") ? value : ","+value; // only prepend a comma if its not the first column
              });
              result += row+"\n";                 // append newline
            });
            // write example to console
            consoleEditor.setCode(result);
        	  originalCode = result;
        	  // clean up options
        	  parseOptions();
        	}
        	else {
        	  // throw an error message on failure
        	  throwErrorMessage("error1000","failed to load example: "+exampleURL);
        	}
        });
      }
      else {
        // load example file
        $.ajax({
        	url     : exampleURL,
        	success : function(data) {
        	  // write example to console on success
        	  consoleEditor.setCode(data);
        	  originalCode = data;
        	  // clean up options
        	  parseOptions();
        	},
        	error   : function(xhr, status, e) {
        	  // throw an error message on failure
        	  var errorMessage = "failed to load example: "+exampleURL
        	                      +"\nstatus: "+xhr.status+" "+xhr.statusText;
        	  throwErrorMessage("error1000",errorMessage);
            consoleEditor.setCode(errorMessage);
        	}
        });
      }
    }
    else if ( exampleURL !== "" && exampleURL !== "#" ) {
      consoleEditor.setCode( unescape( exampleURL.replace("c=","") ) );
      // clean up options
  	  parseOptions();
    }
  }
};


/**
 * helper function to throw an error message
 * @method  throwErrorMessage
 * @param   {String} id error ID
 * @param   {String} message error message to throw
 * @param   {String} type type of error ("highlight" triggers a warning)
 */
var throwErrorMessage = function( id, message, type ) {
  type = type || "error";
  var $errID = $("#"+id, $errorContainer);
  var errType = "Error: ";
  var iconType = "alert";
  if( type === "highlight" ) {
    errType = "Warning: ";
    iconType = "info";
  }
  console.log(errType+message);
  $errorContainer.show("fast");
  if( $errID.length > 0 ) {
    $(".error-message", $errID).html(message);
    $errID.pulse();
  }
  else {
    $errorContainer.append('<div class="ui-widget" id="'+id+'" style="display:none;"><div class="ui-state-'+type+' ui-corner-all"><p><span class="ui-icon ui-icon-'+iconType+'"></span><strong>'+errType+'</strong><span class="error-message">'+message.replace(/\n/g,"<br/>")+'</span></p></div></div>')
      .find("#"+id).fadeIn("fast");
  }
}


/**
 * helper function to remove an error message
 * @method  removeErrorMessage
 * @param   {String} id ID of an element to remove
 */
var removeErrorMessage = function( id ) {
  $("#"+id, $errorContainer).remove();
}


/**
 * helper function to remove all error messages
 * @method  removeAllErrorMessages
 */
var removeAllErrorMessages = function() {
  $errorContainer.hide("fast").html("").show();
}


/**
 * helper function to resize containers to window
 * @method  setContainerSize
 */
var setContainerSize = function(){
  var winHeight = $(window).height();
  var headerHeight = $("h1").height();
  var containerPadding = 2 * parseInt($("#container").css("padding-top"), 10);
  var approx = 100;
  var height = Math.floor( (winHeight - headerHeight - containerPadding - approx) / 2 );

  if( height <= MIN_CONTAINER_HEIGHT ) {
    height = MIN_CONTAINER_HEIGHT;
    $contractSandbox.hide("fast");
  }
  else {
    $contractSandbox.show("fast");
  }

  $codeMirror.height(height);
  $sandbox.height(height);
};


/**
 * helper function to remove log events
 * @method  clearLog
 */
var clearLog = function() {
  $("#logging").html("");
  $("#clearlog").hide("fast");
};


/**
 * helper function to generate a Bit.ly URL via ajax json
 * @method  getTinyURL
 * @param   {String} longURL URL to be shortened
 * @param   {Function} success function to invoke on success
 */
var getTinyURL = function( longURL, success ) {
  lastURL = longURL;
  var URL = "http://api.bit.ly/v3/shorten?"
            +"login="+BITLY_USER
            +"&apiKey="+BITLY_KEY
            +"&longUrl="+encodeURIComponent(longURL)
            +"&format=json";
  if(URL.length >= 2048) {
	  throwErrorMessage("error1005","Short URL cannot be generated. Potential loss of data due to URL length limitations. Consider creating an example file.","highlight");
	}
	else {
	  $.getJSON(URL, function( data ){
      success && success(data.data.url);
    });
  }
};


/**
 * helper function to move preferences from cookie/hash into the Options Form
 * @method  restorePreferences
 * @param   {Object} saved preferences to be restored
 */
var restorePreferences = function( saved ) {
  if( saved.framework ) {
    $frameworkSelector.val(saved.framework);
  }
  if( saved.frameworkurl ) {
    $frameworkCustomURL.val( saved.frameworkurl );
  }
  if( saved.apioptions ) {
    $apiOptions.val( saved.apioptions );
  }
  if( saved.apikey ){
    $apiKey.val( saved.apikey );
  }
};

// Actual Execution begins here

// load in cookies
if( $.cookie("apiconsole") ) {
  // read JSON data into object
  try {
    saved = $.parseJSON( $.cookie("apiconsole") );
  }
  catch(e) {
    throwErrorMessage("error1001","could not load options from cookies");
  }
}
if( loc.hash ) {
  var prefs = loc.hash.replace("#","").split("&");
  if(prefs.length>1) {
    try {
      prefs = $.parseJSON( unescape(prefs[1]) );  // need to unescape the hash
      $.extend(saved, prefs); // replace cookie prefs with hash prefs
    }
    catch(e) {
      throwErrorMessage("error1002","the URL is malformed. Could not retreive preferences.");
    }
  }
}

// Initialize Accordion Sidebar (jQuery UI)
$accordion.accordion({ 
  active: false,      // start accordion in a collapsed state (need to do this for dynamic content)
  clearStyle: true,   // this is needed to work well with dynamic content
  collapsible: true   // allow all accordions to be collapsed (for active to work right)
});


// Load Framework selection via ajax
$("#framework").load( "frameworks.html", function() {
  $frameworkSelector = $("#framework-selector");
  $frameworkCustom = $(".framework-custom", "#framework");
  $frameworkCustomURL = $("#framework-url-custom");
  $codeConsole = $("#code-console");
  $apiOptions = $("#api-options");
  $apiKey = $("#api-key");

  // restore preferences
  restorePreferences(saved);

  // Hide the custom input if a framework is selected
  toggleCustomURL();

  // now that we have the content loaded, we can expand the accordion
  $accordion.accordion('activate',0);

  // toggle the custom input when needed
  $frameworkSelector.change( function() { toggleCustomURL("fast") } );
  
  // make the options textarea resizeable
  //  need to set margin to 0 or IE will center the textarea
  $apiOptions.resizable({ handles: "se" }).parent().css("margin","0");
  
});


// Load the list of examples via ajax
$("#examples").load("examples/examples.html", function() {
  // collapse category groups
  $(".example-group", "#examples").hide();

  // add category event handler (click)
  $("a.category", "#examples").click( function(event) {
    var id = $(this).attr("href");
    id = id.split("#");   // we only want the hash, not the whole URL
    id = "#" + id[1];     // we have to do this run-around for IE
    $(id).toggle("fast"); // toggle category group
    event.preventDefault();
    return false;         // stop default action
  });

  // add event handler to load examples into code area
  $("a",".example-group").click( function(event) {
    var href;
    if($(this).attr("id") === "load-example") {
      href = $("#example-url").val();
    }
    else {
      // we have to use a hash for IE to work
      href = $(this).attr("href").split("#");
      href = href[1];
    }
    loc.hash="#"+href;
    $("html, body").animate({scrollTop:0}, "slow");
    loadExample( href );
    event.preventDefault();
    return false;
  });
});

// stylize buttons (jQuery UI)
$("a", "#button-container").button();

// make the container pretty (jQuery UI)
$("#container").addClass("ui-widget ui-widget-content ui-corner-all");


// event handler for Run click
$("#runcode").click( function(event) {
  executeCode();
  event.preventDefault();
  return false;
});


// event handler for Save click
$("#savecode").click( function(event) {
  console.log("feature not implemented");
  event.preventDefault();
  return false;
});


// event handler for Clean Up click
$("#cleanup").click( function(event) {
  cleanUpEnvironment();
  event.preventDefault();
  return false;
});


// event handler for Clear Log click
$("#clearlog").click( function(event) {
  clearLog();
  event.preventDefault();
  return false;
});


// event handlers to expand and contract the sandbox
$("#expand-sandbox").click( function(event){
  $contractSandbox.show("fast");
  $sandbox.height( $sandbox.height()+EXPAND_HEIGHT );
  $("html, body").animate({scrollTop: $sandbox.height()}, "slow");
  event.preventDefault();
  return false;
});
$contractSandbox.click( function(event){
  var height = $sandbox.height()-EXPAND_HEIGHT;
  if( height <= MIN_CONTAINER_HEIGHT ) {
    height = MIN_CONTAINER_HEIGHT;
    $(this).hide("fast");
  }
  $sandbox.height( height );
  event.preventDefault();
  return false;
});


// hover state for static buttons (jQuery UI stuff)
$("#icons li").hover(
  function() { $(this).addClass("ui-state-hover"); },
	function() { $(this).removeClass("ui-state-hover"); }
);

// set container size and bind to window resize
setContainerSize();
$(window).resize( setContainerSize );

// have to use this method to prevent race condition
setTimeout(tryLoadExample, 20);

});   // END wait for on DOMReady
  
})(jQuery); // END preserve jQuery $ alias