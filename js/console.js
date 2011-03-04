/**
 * Provides application functionality for JavaScript API Developer Console test environment
 * @author      Eugene ONeill (eoneill)
 * @maintainer  Eugene ONeill (eoneill)
 * @requires    jQuery (http://jquery.com/),
 *              jQuery UI (http://jqueryui.com/),
 *              jQuery Cookie Plugin (https://github.com/carhartl/jquery-cookie),
 *              CodeMirror (http://codemirror.net/),
 **/

// set up console to prevent breaking browsers that don't support console.log
if (!window.console || !window.console.log) {
  window.console = window.console || {};
  window.console.log = window.console.log || function(){};
}

// ----------------------------------------------------------------------------------------------------
// ...
// ----------------------------------------------------------------------------------------------------
;(function($, undef) { // protect script, preserve jQuery $ alias, and don't trust global undefined

// custom jQuery pulse effect
$.fn.pulse = function(settings) {
  settings = $.extend({
    duration: "medium",
    fadeTo: 0.7
  }, settings);
  this.each( function() {
    $(this).fadeTo(settings.duration,settings.fadeTo)
      .fadeTo(settings.duration,1)
      .fadeTo(settings.duration,settings.fadeTo)
      .fadeTo(settings.duration,1)
      .click( function() {
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
var MIN_CONTAINER_HEIGHT = 260; //minimum height that a container should be (in px) 
var EXPAND_HEIGHT = 100;        // height to expand the result bar
var BITLY_USER = "eoneill";     // Bit.ly API settings
var BITLY_KEY = "R_4f1d96e89bee1a8d88edb114dd0c1e4b";
var CONNECT_API_KEY = "up8hQML83EYXioHsDsw4ktyShFAoNwJzhY8WDmJPZWdqRVzaIvw9r0phLieHH_c5";
var SESSION_BUTTON = '\n<div style="border: 1px dashed #adadad; position: absolute; right: 20px; top: 5px; padding: 10px;"><script type="IN/Login" data-label="action">[ <a href="#" onclick="IN.User.logout(); return false;">logout</a> ]</script></div>';
var MSIE6 = document.body.style.maxHeight === undef;

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
var $includeButtons;

// a few global-esque vars */
var originalCode = "";  // used to compare if code changes occured
var saved = {};         // use this to hold cookies/preferences
var tinyURLs = [];      // URLs generated by bit.ly (reduce server hits)
var isCustomApiKey = false;


// create editor
var $codeMirror = $("#code-console");
var consoleEditor = {
  getCode: function() {
    return $codeMirror.val();
  },
  setCode: function(data) {
    $codeMirror.val(data);
  }
};

/*if( (document.body.style.maxHeight !== undef) ) {
  consoleEditor = CodeMirror.fromTextArea("code-console", {
    parserfile: ["parsexml.js", "parsecss.js", "tokenizejavascript.js", "parsejavascript.js", "parsehtmlmixed.js"],
    stylesheet: ["css/codemirror/xmlcolors.css", "css/codemirror/jscolors.css", "css/codemirror/csscolors.css"],
    path      : "js/codemirror/"
  });
  $codeMirror = $(".CodeMirror-wrapping", "#console-container");
}*/

/**
 * helper function to reset the environment
 *  this helps ensure that subsequent runs will work properly
 * @method  tryLoadExample
 */
var tryLoadExample = function() {
  try {
    // load in an example
    var urlhref = getExampleFromHash();
    if ( urlhref !== "" ) {
      var $exampleLink = $('a[href*="' + urlhref + '"]');
      if( $exampleLink.length === 1 ) { // if the URL is a standard example, do some fancy stuff
        $exampleLink.click().parent().parent().show();
      }
      else {  // otherwise just open the example file
        loadExample( urlhref, "Custom Example" );
      }
    }
    else {
      // load the first example
      $(".example-group:eq(0)", "#examples").show()   // open a category
        .find("a:eq(0)").click();                                    // select a random example from the open category
    }
  }
  catch(e) {
    setTimeout(tryLoadExample, 40);
  }
};

/**
 * TAKEN FROM IN.JS
 */
/**
 * Splits a string more like PHP does. Basically, we want to break it into N parts
 * based on a delimiter character
 * @function str_split
 * @param string {String} the string to split
 * @param delimiter {String} the delimiter to split on
 * @param limit {Integer} the number of pieces to return
 * @return {Array} the array of pieces
 */
function str_split(string, delimiter, limit) {
  if (!limit) {
    return string.split(delimiter);
  }
  var splitted = string.split(delimiter);
  if (splitted.length < limit) {
    return splitted;
  }
  var partA = splitted.splice(0, limit - 1);
  var partB = splitted.join(delimiter);
  partA.push(partB);
  return partA;
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
  
  isCustomApiKey = false;
  
  if( saved.extendapioptions ) {
    // append extended options
    options = options + "\n" + saved.extendapioptions;
  }
  
  if( options !== "" ) {
    var code = "";
    if(options.search("onLoad") !== -1) {
      code = consoleEditor.getCode();
    }
    options = options.split("\n");
    $.each( options, function(key, value) {
      if( value !== "" ) {
        var temp = str_split(value.replace(/\s+/g,""), ":", 2); // removes whitespace and splits into key:value pairs
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
         *  (4 - deprecated) if the user selected the Production framework, enforce some default values
         *      - authorize: false
         *      - credentials_cookie: false
         */
        if( processed[ temp[0] ] !== undef ) {            // rule(1)
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
                if( code.search(val) !== -1 ) {
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
        else if( temp[1] === "" || temp[1] === undef ) {    // rule(3) no paramter value set
          skip = true;
        }
        /*else if( $frameworkSelector.val() !== "custom" ) {    // rule(4)
          // using production framework, apply overrides
          if( PROD_OPTIONS[ temp[0] ] !== undef ) {
            processed[temp[0]] = true;
            skip = true;
          }
        }*/
        else {
          if( temp[0] === "api_key" ) {
            isCustomApiKey = true;
          }
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

  $tinyURLContainer.pulse( {duration: "fast"} );
  
  // remove previous error messages
  removeAllErrorMessages();
};


/**
 * helper function to execute the request
 * @method  executeCode
 * @param   {Boolean} allowBadOnLoad passed directly to parseOptions()
 */
var executeCode = function( allowBadOnLoad ) {
  parseOptions( allowBadOnLoad );   // ensure that option rules are enforced
  
  // fix inconsistent loc.protocol (some browsers will return "http", others return "http:")
  var protocol = loc.protocol.replace(/\:/g,"") + "://";
  // we currently don't serve https://platform.linkedin.com/in.js
  // when we do, we will remove this line of code and allow real https requests
  // in the meantime, we will have to allow unsecure content in IE (broken in IE6 still)
  protocol = "http://";
  
  var framework = "Production";
  var frameworkURL = $frameworkCustomURL.val();
  var doTinyURL;
  var connectURL = $frameworkSelector.val();
  var apiOptions = $apiOptions.val();
  var apiKey = $apiKey.val();
  // store preferences in JSON formatted string
  var preferences = '{'
        +'"framework":"'+$frameworkSelector.val()+'",'
        +'"frameworkurl":"'+frameworkURL+'",'
        +'"apikey":"'+apiKey+'",'
        +'"apioptions":"'+apiOptions.replace(/\n/g,"\\n")+'",'  // we need to escape newlines for valid JSON
        +'"sessionbuttons":'+$includeButtons.is(":checked")     // note: this is boolean, no quotes
      +'}';
  // some API key magic
  if( (connectURL !== "custom" || frameworkURL === "") && !isCustomApiKey) {
    // default to the Connect API Key
    apiKey = "api_key: "+CONNECT_API_KEY+"\n";
  }
  else if( isCustomApiKey ) {
    // API Key override (api_key was specified in params)
    apiKey = "";
  }
  else {
    // 
    apiKey = "api_key: "+apiKey+"\n";
  }
  
  var params = apiKey+apiOptions;
  var runCode = consoleEditor.getCode();
  var exampleData = getExampleFromHash();
  // save settings to cookie (as JSON)
  $.cookie( "apiconsole", preferences, { path: '/', expires: 365 } );

  if(runCode !== originalCode) {
    exampleData = "c="+escape(runCode);
  }
  loc.hash = "#" + exampleData + "&" + preferences;
  
  doTinyURL = tinyURLs[loc.href];
  cleanUpEnvironment( doTinyURL !== undef );
  
  // generate a TinyURL
  if(doTinyURL === undef) {
    getTinyURL(loc.href, function(tinyurl) {
      $tinyURL.text(tinyurl).attr("href",tinyurl);
      tinyURLs[loc.href] = tinyurl;
    });
  }
  else {
    $tinyURL.text(doTinyURL).attr("href",doTinyURL);
  }
  
  // was a custom URL provided?
  if(connectURL === "custom") {
    connectURL = frameworkURL;
    if(connectURL === "") {
      connectURL = protocol + $("option", $frameworkSelector).first().val();
    }
    else {
      framework = connectURL;
    }
  }
  else {
    connectURL = protocol + connectURL;
  }
  // show the status of the framework
  $("#framework-using").text(framework);
  $("#framework-status").removeClass("ui-helper-hidden");
  // create a tooltip
  if($("#framework-status").data("qtip")) {
    $("#framework-status").qtip("destroy");
  }
  $("#framework-status").qtip( {
    content: '<strong>Framework URL:</strong> '+connectURL+'<br/><strong>Parameters:</strong><br/>'
                +params.replace(/\n/g,'<br/>'),
    position: {
      corner: {
        target: "bottomMiddle",
        tooltip: "topMiddle"
      }
    },
    style: {
      width: 300,
      border: {
        width: 2,
        radius: 3
      },
      tip: "topMiddle",
      name: "light"
    }
  });
  
  // build the sandbox iframe
  try {
    if($includeButtons.is(":checked")) {
      runCode += SESSION_BUTTON;
    }
    // set a window function that will give us the HTML for the sandbox
    // it gets overwritten on each run
    window.getSandboxHtml = function getSandboxHtml() {
      return ['',
              '<script type="text/javascript" src="'+connectURL+'">',
              params,
              '</script>',
              '\n',
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
 * helper function to display the generated code
 * @method  getCode
 */
var getCode = function() {
  if(window.getSandboxHtml) {
    var html = window.getSandboxHtml().replace(CONNECT_API_KEY,"YOUR_API_KEY").replace(SESSION_BUTTON,"");
    $("#codeview textarea").val(html).parent().dialog("open");
  }
  else {
    setTimeout(getCode, 100);
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
      example = example[0];
      if( example !== "" && example !== "#" && 
          example !== undef && example !== "undefined" ) {
        return example;
      }
    }
  }
  return "";
};


/**
 * helper function to load example file via ajax
 * @method  loadExample
 * @param   {String} loadData data to be parsed
 */
var loadExample = function( loadData, title ) {
  if( loadData !== "" && loadData !== "#" && 
      loadData !== undef && loadData !== "undefined" )
  {
    saved.extendapioptions = undef;
    
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
    $("#title").text("Code");
    if( exampleURL.search("c=") === -1 ) { // no custom code was provided
      if( exampleURL.match(/(https?|ftp):\/\/.+/) ) {
        // a full URL was provided, we pull down the file using CSV via YQL
        exampleURL = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20csv%20where%20url%3D%22"+encodeURIComponent(exampleURL)+"%22&format=json";
        $.ajax({
          url : exampleURL,
          dataType : "jsonp",
          success : function(data) {
            if(data.query.count !== "0") {
              // now that we have the CSV returned as JSON, we need
              // to parse it and recombine the rows and columns
              var rows = data.query.results.row;    // rows of data
              var result = "";
              $.each(rows, function(k, cols) {       // loop through each row and append a newline \n
                var row = "";
                $.each(cols, function(key, value) {  // loop through each column and prepend a comma
                  value = value || "";    // takes care of the case when value === null (an empty line)
                  row += (key === "col0") ? value : ","+value; // only prepend a comma if its not the first column
                });
                result += row+"\n";                 // append newline
              });
              // write example to console
              consoleEditor.setCode(result);
              originalCode = result;
              // we can't run the code immediately, it will introduce a race condition
              setTimeout( function(){ executeCode(false); }, 20);
            }
            else {
              // throw an error message on failure
              throwErrorMessage("error1000","failed to load example: "+exampleURL);
            }
          },
          error : function(xhr, status, e) {
            // throw an error message on failure
            var errorMessage = "failed to load example: "+exampleURL
                                +"\nstatus: "+xhr.status+" "+xhr.statusText;
            throwErrorMessage("error1000",errorMessage);
            consoleEditor.setCode(errorMessage);
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
            $("#title").text("Code - "+title);
            // we can't run the code immediately, it will introduce a race condition
            setTimeout( function(){ executeCode(false); }, 20);
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
      setTimeout( function(){ executeCode(false); }, 20);
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
  //console.log(errType+message);
  $errorContainer.show("fast");
  if( $errID.length > 0 ) {
    $(".error-message", $errID).html(message);
    $errID.pulse();
  }
  else {
    $errorContainer.append('<div id="'+id+'" style="display:none;"><div class="ui-state-'+type+' ui-corner-all"><p><span class="ui-icon ui-icon-'+iconType+'"></span><strong>'+errType+'</strong><span class="error-message">'+message.replace(/\n/g," | ")+'</span></p></div></div>')
       .find("#"+id).fadeIn("fast");
  }
};


/**
 * helper function to remove an error message
 * @method  removeErrorMessage
 * @param   {String} id ID of an element to remove
 */
var removeErrorMessage = function( id ) {
  $("#"+id, $errorContainer).remove();
};


/**
 * helper function to remove all error messages
 * @method  removeAllErrorMessages
 */
var removeAllErrorMessages = function() {
  $errorContainer.hide("fast").html("").show();
};


/**
 * helper function to resize containers to window
 * @method  setContainerSize
 */
var setContainerSize = function() {
  var winHeight = $(window).height();
  var headerHeight = $("#header").height()+$("#subheader").height();
  var containerPadding = 2 * parseInt($("#container").css("padding-top"), 22);
  var approx = 210;   // approximate the other space, we could add up all the other elements, but it's just excessive
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
var getTinyURL = function( longURL, onSuccess ) {
  lastURL = longURL;
  var URL = "http://api.bit.ly/v3/shorten?"
            +"login="+BITLY_USER
            +"&apiKey="+BITLY_KEY
            +"&longUrl="+encodeURIComponent(longURL)
            +"&format=json";
  if(URL.length >= 2048) {
    throwErrorMessage("error1005","Short URL cannot be generated. Consider creating an example file.","highlight");
  }
  else {
    $.ajax({
      url : URL,
      dataType : "jsonp",
      success : function( data ) {
        onSuccess(data.data.url);
      }
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
  if( saved.apikey ) {
    $apiKey.val( saved.apikey );
  }
  if( saved.sessionbuttons !== undef ) {
    $includeButtons.attr("checked", saved.sessionbuttons);
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
      $.extend(saved, prefs);                     // replace cookie prefs with hash prefs
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
  $includeButtons = $("#include-buttons");

  // restore preferences
  restorePreferences(saved);

  // Hide the custom input if a framework is selected
  toggleCustomURL();
  
  // toggle the custom input when needed
  $frameworkSelector.change( function() { toggleCustomURL("fast"); } );
  
  // make the options textarea resizeable
  //  need to set margin to 0 or IE will center the textarea
  $apiOptions.resizable({ handles: "se" }).parent().css("margin","0");
  
});

// Load in reference material
$("#reference").load("documentation.html");

// Load the list of examples via ajax
$("#examples").load("examples/examples.html", function() {
  // collapse category groups
  var $exampleGroups = $(".example-group", this);
  
  // attach tooltips for examples (descriptions)
  $("a[title]", this).qtip({
    style: {
      name: "light",
      tip: "leftMiddle",
      border: {
        width: 2,
        radius: 3
      }
    }, 
    position: {
      corner: {
         target: 'rightMiddle',
         tooltip: 'leftMiddle'
      }
    }
  });
  
  // add category event handler (click)
  $("a.category", this).click( function(event) {
    var id = $(this).attr("href");
    id = id.split("#");   // we only want the hash, not the whole URL
    id = "#" + id[1];     // we have to do this run-around for IE
       
    $(id).toggle("fast");
    event.preventDefault();
    return false;         // stop default action
  });
  
  // add event handler to load examples into code area
  $("a",$exampleGroups).click( function(event) {
    var href;
    var $prev = $(this).prev().prev();
    if($(this).attr("id") === "load-example") {
      href = $("#example-url").val();
    }
    else {
      // we have to use a hash for IE to work
      href = $(this).attr("href").split("#");
      href = href[1];
    }
    $("li, input", $exampleGroups).removeClass("ui-state-highlight");
    
    if( $prev.is("#example-url") ) {
      $prev.addClass("ui-state-highlight");
    }
    else {
      $(this).parent().addClass("ui-state-highlight");
    }
    loc.hash="#"+href;
    $("html, body").animate({scrollTop:0}, "slow");
    
    loadExample( href, $(this).text() );
    event.preventDefault();
    return false;
  });
  
  // have to use this method to prevent race condition
  setTimeout(tryLoadExample, 40);
  
  
  /*continually refresh the page, testing for bug in IE*\/
  var f = function f() {
    var links = $("a",$exampleGroups);
    var randInt = Number((Math.floor(Math.random()*(links.length-1))));
    links.eq(randInt).click(); setTimeout(f, 4000)
  };
  setTimeout( f , 4000);
  /**/
  
  // now that we have the content loaded, we can expand the accordion
  $accordion.accordion('activate',2);   // open accordion to Examples
});


// stylize buttons (jQuery UI)
$("a", "#button-container").button();


// make the container pretty (jQuery UI)
$("#container").addClass("ui-widget ui-widget-content ui-corner-all");


$("#getcode").click( function(event) {
  getCode();
  event.preventDefault();
  return false;
});

// event handler for Run click
$("#runcode").click( function(event) {
  executeCode( true );
  event.preventDefault();
  return false;
});


// event handler for Clean Up click
$("#cleanup").click( function(event) {
  cleanUpEnvironment();
  event.preventDefault();
  return false;
});


// event handlers to expand and contract the sandbox
$("#expand-sandbox").click( function(event) {
  var height = $sandbox.height()+EXPAND_HEIGHT;
  $contractSandbox.show("fast");
  $sandbox.height(height);
  if(MSIE6) {
    $("#sandboxrunner").height(height);
  }
  $("html, body").stop(true, true).animate({scrollTop: height}, "fast");
  event.preventDefault();
  return false;
});
$contractSandbox.click( function(event) {
  var height = $sandbox.height()-EXPAND_HEIGHT;
  if( height <= MIN_CONTAINER_HEIGHT ) {
    height = MIN_CONTAINER_HEIGHT;
    $(this).hide("fast");
  }
  $sandbox.height(height);
  if(MSIE6) {
    $("#sandboxrunner").height(height);
  }
  event.preventDefault();
  return false;
});


// hover state for static buttons (jQuery UI stuff)
$("#icons li").hover(
  function() { $(this).addClass("ui-state-hover"); },
  function() { $(this).removeClass("ui-state-hover"); }
);


// create a dialog box to hold the code
$("#codeview").dialog({ autoOpen: false, height: 400, width: 800, resizable: false });


// set container size and bind to window resize
setContainerSize();
// IE triggers window resize for everything,
// so we will only apply this to non-IE browsers
if( /*@cc_on !@*/true ) {
  $(window).resize( setContainerSize );
}

// scroll wheel handler
//  we do this to prevent weird behavior when scrollTop animations
//  are being used and the user tries to scroll the mouse wheel
$(window).scroll( function() {
  $("html, body").stop(true, true);
});


// add tooltip for 
$("#tiny-url-container").qtip( {
  content: "Use this URL to quickly share or bookmark this example!",
  position: {
    corner: {
      target: "bottomMiddle",
      tooltip: "topMiddle"
    }
  },
  style: {
    width: 300,
    border: {
      width: 2,
      radius: 3
    },
    tip: "topMiddle",
    name: "light"
  }
});

});   // END wait for on DOMReady

})(jQuery);   // END preserve jQuery $ alias
