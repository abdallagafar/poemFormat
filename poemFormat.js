// =============================================================================
// Format contents of a container (e.g., div) as a poem
// 2024-02-26: First created by Abdalla G. M. Ahmed
// =============================================================================

console.log("Entering poemFormat.js");

var poemFormatGrossCounter = 0;                                                  // Count all parsed beits

function poemFormat(poem) {
    // =========================================================================
    // Constants
    // =========================================================================
    const FREE = 1;                                                             // Free (non-column) style
    const SINGLE_COLUMN = 2;                                                    // Enforce a single column, for musdar, e.g.
    const MUSDAR = 4;                                                           // A special flag for musdar, which implies a width also
    const SMART_QUOTES = 8;                                                     // Replace straight quotes by smart quotes
    const WRAP = 16;                                                            // Wrap wide verses between lines
    const HYPHENS2DASH = 32;                                                    // Replace --- by mdash — and -- by ndash –
    const WIDTH_LOCAL = 64;                                                     // Compute verse width locally for a block
    const NUMBER = 128;                                                         // Number the beits lines
    const GROSS = 256;                                                          // Number the beits in the whole page
    const RESET_COUNTER = 512;                                                  // Reset Counter to zero with each block
    const STAGGERED = 1024;                                                     // Split halves between lines and indent second half
    const SKIP = 2048;                                                          // Skip counting beits in the current block
    const EMPH = 4096;                                                          // Emphasize beits in accordance with chosen stylization, typically a different color
    const LTR = 2048;                                                           // Set text direction to left-to-right
    const OPTIONS_DEFAULT = SMART_QUOTES + WRAP + HYPHENS2DASH;
    const FLAGS = {                                                             // Arabic keys for toggling the flags
        /* ABC */ 'حر'      : FREE,                                             // The dummy comments are to make the Arabic text align left.
        /* ABC */ 'عمود'    : SINGLE_COLUMN,
        /* ABC */ 'مسدار'   : MUSDAR,
        /* ABC */ 'تنصيص'   : SMART_QUOTES,
        /* ABC */ 'طي'      : WRAP,
        /* ABC */ 'داش'     : HYPHENS2DASH,
        /* ABC */ 'عرض'     : WIDTH_LOCAL,
        /* ABC */ 'ترقيم'   : NUMBER,
        /* ABC */ 'إجمالي'  : GROSS,
        /* ABC */ 'تصفير'   : RESET_COUNTER,
        /* ABC */ 'فط'      : SKIP,
        /* ABC */ 'تظهير'   : EMPH,
        /* ABC */ 'تداخل'   : STAGGERED,
        /* ABC */ 'EN'      : LTR
    };
    const DATA_LABELS = {
        /* ABC */ 'عرض'     : 'bWidthMin',
        /* ABC */ 'ترقيم'   : 'beitNo',
        /* ABC */ 'كلاس'     : 'classList'
    };
    const nGaps  = [2, 0, 1, 2, 3, 4];                                          // Number of gaps for different number of parts
    const bGap = 50;                                                            // This is twice the sum of widths of bPrefix and bSuffix in CSS
    const bStaggerOffset = 75;                                                  // Should match CSS
    const bWidthMax = 450;                                                      // This should match the CSS declaration of the width of poemBody div less padding and bPrefix/bSuffix width
    const MUSDAR_WIDTH = 270;                                                   // Empirical, assuming 16px font. TODO: these should be in em units.
    const elementSeparator = ' <-> ';                                           // A placeholder for separating identified parts during processing
    const partSeparator = ' <=> ';                                              // A placeholder for separating prefix/body/suffix of a part
    const titlePlcHldr = '<+>';                                                 // A placeholder for in-place footnotes, distinct from '+' characters that may exist in the text
    const ftntPlcHldr = '<*>';                                                  // A placeholder for gutter footnotes
    // =========================================================================
    // Global Variables
    // =========================================================================
    var paramsGlobal = {bWidthMin: 0, beitNo: 0, classList: ''};                // Global options defaults
    var paramsLocal  = {bWidthMin: 0, beitNo: 0, classList: ''};                // Options for blocks
    var flagsGlobal = (                                                         // Global flags (on/off switches)
        getData(
            (poem.getAttribute('data-params') || ''),                           // List of passed parameters, if any
            paramsGlobal                                                        // Adjust global parameters from the list
        ) ^ OPTIONS_DEFAULT                                                     // User flags are merged with defaults rather than replace them
    );
        if (paramsGlobal.beitNo) flagsGlobal |= NUMBER;                         // Setting a beit number implies numbering
        else paramsGlobal.beitNo = 1;                                           // Otherwise, initialize it
    var flags = flagsGlobal;                                                    // Use global unless changed by inline parameters
    var bWidthGlobal = paramsGlobal.bWidthMin;                                  // Common overall width of beit
    var attribs = poem.getAttribute('data-attribs') || '';                      // Attributes passed to the div.
        if (attribs) attribs = ' ' + attribs;
    var classList = poem.getAttribute('data-classList') || '';
        if (classList) classList = 'poemBody ' + classList;
        else classList = 'poemBody';
    var staggeredGlobal = (flagsGlobal & STAGGERED) !== 0;
    var computedStyle = window.getComputedStyle(poem);
    var fontStyle = [
        computedStyle.fontStyle,
        computedStyle.fontVariant,
        computedStyle.fontWeight,
        computedStyle.fontSize,
        computedStyle.fontFamily
    ].join(' ');
    var beitNo = (
        (flagsGlobal & GROSS) ?
        poemFormatGrossCounter + 1 :
        paramsGlobal.beitNo
    );
    var lines = (
        poem
        .innerHTML                                                              // We get the HTML to retain inline tags <a,i,b,s,u>
        .replace(/&nbsp;/g, ' ')                                                // Replace non-breaking spaces inserted by some web engines, e.g., Mediawiki
        .replace(/<\/p><p>/gi, '<br>\n')                                        // Undo wiki removal of single empty lines
        .replace(/\s*<(p|div|pre)[^>]*>/gi, '')                                 // Remove opening container tags and preceding whitespace
        .replace(/<\/(p|div|pre)>/gi, '')                                       // Remove closing tags
        .replace(/\s*<hr[^>]*>\s*/gi, '\n----\n')                               // Replace <hr> in wiki with our symbol for an <hr>
        .replace(/<br>/gi, '\n')                                                // Replace line break tags with line-break characters
        .trim()                                                                 // Remove leading and trailing empty lines so that the enclosing <div> tag may be placed in separate lines
    );
    var ftntTitles = [];                                                        // Array to hold the contents of in-place notes.
    var ftntReferenced = [];                                                    // Referenced footnotes
    var ftntStandalone = [];                                                    // Standalone footnotes
    var ftntLabels = [];                                                        // Array to save footnote labels during processing

    // =========================================================================
    // Core function: format a block of filtered poem lines
    // =========================================================================
    function formatLines(lines) {
        // ---------------------------------------------------------------------
        // Splitting lines
        // ---------------------------------------------------------------------
        if (!lines) { return ''; }                                              // Happens when starting with a separator line, e.g., for formatting.
        if (lines.match(/(?:^|\n) *\+{3,}.*?\n/)) {                             // Block separator, try to extract parameters, if any
            flags = flagsGlobal;                                                // Reset flags
            if (flagsGlobal & RESET_COUNTER) beitNo = 1;
            paramsLocal = {bWidthMin: 0, beitNo: 0, classList: ''};             // Reset local parameters
            flags ^= getData(                                                   // Toggle designated flags, if any
                lines.replace(/^\s*\+*/, ''),                                   // Trim the "+" signs
                paramsLocal,                                                    // Retrieve local parameters, if any
            );
            if (paramsLocal.beitNo) {                                           // If a beit number is specified
                beitNo = paramsLocal.beitNo;                                    // Adjust beitNo
                flags |= NUMBER;                                                // And turn on numbering
            }
            if (flags & SKIP) {
                flags ^= flags & NUMBER;                                        // Skipping implies no numbering
            }
            return '';                                                          // Done with separator, return for next block
        }
        // ---------------------------------------------------------------------
        // Free style
        // ---------------------------------------------------------------------
        if (flags & FREE) {                                                     // Modern free poetry
            return (
                '<p class="bFree">' +
                ftntLblsRstr(lines)                                             // Restore footnote labels
                + '</p>'                                                        // Close last paragraph
            );
        }
        // ---------------------------------------------------------------------
        // Normal
        // ---------------------------------------------------------------------
        var bWidth = paramsLocal.bWidthMin;                                     // Initial bWidth
        var pWidth = [0, 0, 0, 0, 0, 0];                                        // Widths of part for different number of parts, index 0 is used for centered verses
        var staggered = (flags & STAGGERED) !== 0;                              // Whether the poem is fed as one half per line, indenting second halves
        lines = flagsApply(lines);                                              // Apply option flags
        lines = (
            lines
            .replace(/^ *(\..*\.) *$/gm, '$1')                                  // Trim spaces around centered lines to avoid confusion with indentation
            .replace(/^ *(!.*)$/gm, '$1')                                       // Trim spaces in the beginning of comment lines to avoid confusion with indentation
            .replace(
                /\n {2,}(\S)/g,                                                 // Remaining indented lines?
                function(match,char) { staggered = true; return '  ' + char; }  // Merge with preceding half, and declare staggered as true
            )
            .split(/\r?\n/)                                                     // Break into lines, assuming one beit per line
        );
        var formattedLines = [];                                                // Array to hold formatted lines
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var bClass = 'beit';                                                // Default class
            var bAttribs = ((flags & LTR) ? ' dir="LTR"' : '');                 // Attributes of paragraph
            if (flags & EMPH) bClass += ' bEmph';
            if (line.match(/[^+]\+\+$/)) {                                      // A line ending with "++" is emphasized
                if (!(flags & EMPH)) { bClass += ' bEmph' };
                line = line.slice(0, -2).trim();                                // Remove the symbols and preceding spaces
            }
            line = line.trim();                                                 // Remove white space around
            var nParts =  0;                                                    // Number of parts
            if (!line) {                                                        // Empty line?
                formattedLines.push('<br>');                                    // Replace by a line break
                continue;                                                       // Next!
            }
            else if (line === "----") {                                         // Separator line
                formattedLines.push('<hr style="width:%hWidth%px">');           // Insert a horizontal break formatted to the width of verses
                continue;                                                       // Next!
            }
            else if (line.match(/^!.*!$/)) {                                    // Enclosed between exclamation marks are centered comments
                formattedLines.push(
                    '<p class="bCommentCenter">'                                // Enclose in a comment paragraph
                    + ftntLblsRstr(line.substring(1, line.length - 1))          // Remove delimiters and restore footnote labels, if any
                    + '</p>'
                );
                continue;                                                       // Next!
            }
            else if (line.match(/^!/)) {                                        // A line starting with an exclamation mark is a comment
                line = line.substring(1).trim();                                // Remove mark and white space
                if (line) {                                                     // Anything left? Otherwise, this is just an empty line in source for readability
                    formattedLines.push(
                        '<p class="bComment">'                                  // Enclose in a comment paragraph
                        + ftntLblsRstr(line)                                    // Restore footnote labels, if any
                        + '</p>'
                    );
                }
                continue;                                                       // Next!
            }
            else if (line === "..." || line === "…") {                          // Ellipses are interpreted as vertical ellipses
                formattedLines.push('<p class="beit">⋮</p>');                   // &#x22ee;
                continue;                                                       // Next!
            }
            else if (line.match(/^\.\..*[^ .].*\.\.$/)) {                       // Lines delimited by two dots but not only dots are treated as closing halves.
                line = (
                    line
                    .substring(2, line.length - 2)                              // Remove delimiters
                    .trim()                                                     // Remove white space that may offset delimiters
                    .replace(/\s{2,}/g, ' ')                                    // Remove multiple spaces to ensure processing as a single part
                );
                nParts = 1;                                                     // To process as a half or two rather than a one
                // No continue here, process normally as a beit.
            }
            else if (line.match(/^\..*[^ .].*\.$/)) {                           // Excluding the two-dots, lines delimited by dots are centered.
                line = line.substring(1, line.length - 1).trim();               // Remove delimiters and any white space
                pWidth[0] = Math.max(pWidth[0], measureTextWidth(line));
                formattedLines.push(
                    '<p class="' + bClass + '"' + bAttribs + '>'
                    + '<span class="bJustified">'
                    + line
                    + '</span>'
                    + '</p>'
                );
                continue;                                                       // Next
            }
            // -----------------------------------------------------------------
            // Now we are left with actual lines of the poem.
            // We apply the following steps:
            // 1. Collect tags and replace them with placeholders containing
            //    no spaces, so that they are handled as single tokens
            // 2. Split parts of the beit
            // 3. Split elements of each part: prefix,core,suffix
            // 4. Split words of each core and enclose into span nodes
            // 5. Join elements and parts with distinct splitting marks
            // 6. Distribute tags over enclosed tokens
            // 7. Restore tags
            // 8. Split again at marks inserted in 5
            // 9. Measure widths of cores of parts, now in final formatting
            // -----------------------------------------------------------------
            bAttribs += (
                ' data-number="' + west2eastDigits(beitNo.toString()) + '"'
            );
            if ((flags & NUMBER) || (paramsLocal.beitNo)) {
                bClass += " bNumbered";
            }
            // -----------------------------------------------------------------
            // Collect inline tags and replace with all-symbols placeholders
            // to enable correct splitting of prefixes and suffixes
            // -----------------------------------------------------------------
            var tags = [];
            line = line.replace(
                /<\/([abius])>/gi,                                              // Find closing <a/i/b/u/s> tags, this gives the right order for nested tags
                function(match, tag) {
                    return '</' + (tags.push(tag) - 1) + '>';
                }
            );
            var tagsOpen = tags.map(function(tag, index) {                      // Iterate to find matching opening tags
                var tagOpen = '';
                var placeholder = '<' + index + '>';
                line = line.replace(
                    new RegExp('<' + tag + '(?:\\s[^>]*)?>', 'i'),              // First occurrence of a matching opening tag
                    function(match) {
                        tagOpen = match;                                        // Capture the matching tag
                        return placeholder;                                     // This return is to replace the tag placeholder in the line text
                    }
                );
                return tagOpen;                                                 // This return is for inserting the matching opening tag in the list
            });
            // -----------------------------------------------------------------
            // Split parts
            // -----------------------------------------------------------------
            line = (
                (flags & SINGLE_COLUMN) ?                                       // Single column requested?
                ([line]) :                                                      // Insert whole line as a single part, otherwise:
                (line.split(/\s{2,}/))                                          // Split at two or more spaces
            );
            nParts += line.length;                                              // The initial number of parts may be 1 for closing halves
            // -----------------------------------------------------------------
            // Pre-process parts
            // -----------------------------------------------------------------
            line = (
                line
                .map(function(part) {                                           // For each part:
                    part = (
                        part
                        .replace(/<\/?\d/g, ' $&').replace(/\d>/g, '$& ')       // Offset inline tag placeholders from words to isolate words as separate tokens
                        .replace(/\.{2,}/g, function(match) {                   // Capture ellipses ".."
                            return match.replace(/\./g, 'ة')                    // Replace dots by meaningless letter placeholders "ةة.." so that they are handled as words
                        })
                    );
                    var elements = part.match(
                        /^ *{(.*?)} *{(.*?)} *{(.*?)} *$/                       // Try user-specified section splitting
                    );
                    if (!elements) {                                            // If not provided, try the default automatic splitting
                        elements = (
                            part
                            .match(                                             // Split into three elements: punctuation/core/punctuation
                                /^([^\u0620-\u064Aa-zA-Z]*)([\u0620-\u064Aa-zA-Z].*[\u0620-\u065Fa-zA-Z])([^\u0620-\u065Fa-zA-Z]*)$/
                                /*(      non-letters      )(    First letter     ..    Last letter      )(      non-letters      )*/
                            )
                        );
                    }
                    if (!elements) {                                            // Typically happens when the line contains only symbols
                        elements = ['', part, '', ''];                          // Put all contents in prefix
                    }
                    elements.shift();                                           // Pop the first entry, which matches the whole regex
                    // ---------------------------------------------------------
                    // Enclose words in spans to enable justification
                    // ---------------------------------------------------------
                    elements[1] = (                                             // The body
                        elements[1]
                        .replace(/ة{2,}/g, function(match) {                    // Restore ellipses
                            return match.replace(/ة/g, '.')
                        })
                        .split(' ')                                             // Split at spaces, hence preserve spaces
                        .map(function(item) {
                            if (!item) { return ''; }
                            if (/^<.*>$/.test(item)) { return item; }           // Return tag placeholders as is
                            return '<span>' + item + '</span>';                 // Enclose each word in a span to enable justification
                        })
                        .join(' ')                                              // Join all items back
                    );
                    return elements.join(' <-> ');                              // A separator mark between elements
                })
                .join(' <=> ')                                                  // A separator mark between parts
            );
            // -----------------------------------------------------------------
            // Distribute tags over words so that they can be split properly
            // between parts/elements
            // The order we collected the tags makes the innermost nested tags
            // processed first, hence nest them properly
            // -----------------------------------------------------------------
            tags.map(function(tag, i) {                                         // For the ith tag ..
                line = line.replace(
                    new RegExp(' <' + i + '> (.*) </' + i + '> '),              // Find the enclosed text, note the separating spaces
                    function(match, content) {
                        return (
                            content                                             // Content inside tag
                            .split(' ')                                         // Split at each single space
                            .map(function(item) {
                                if (!item) return '';                           // Return empty strings as is, hence preserving multiple spaces
                                if (/<[-=]>/.test(item)) { return item; }       // Return part/element separators as is
                                return '<' + i + '>' + item + '</' + i + '>';   // Enclose contiguous non-white space in the tag
                            })
                            .join(' ')                                          // Join all items back together, offset by single spaces
                            .replace()
                        );
                    }
                );
            });
            // -----------------------------------------------------------------
            // Restore tags
            // -----------------------------------------------------------------
            tags.map(function(tag, i) {                                         // For the ith tag ..
                line = (
                    line
                    .replace(new RegExp('<'+i+'>', 'g'), tagsOpen[i])
                    .replace(new RegExp('<\/'+i+'>', 'g'), '</' + tag + '>')
                );
            });
            // -----------------------------------------------------------------
            // Now split again to format parts
            // -----------------------------------------------------------------
            var partWidth = 0;                                                  // Maximum part length
            line = (
                line
                .split(' <=> ')
                .map(function(part) {
                    part = ftntLblsRstr(part);
                    var elements = part.split(' <-> ');
                    // ---------------------------------------------------------
                    partWidth = Math.max(
                        partWidth, measureTextWidth(elements[1], fontStyle)     // Update longest part length
                    );
                    return (
                        '<span class="bPrefix">' + elements[0] + '</span>' +
                        '<span class="bJustified" '
                        + 'style="width:%pWidth' + nParts + '%px">'
                        + elements[1] +
                        '</span>' +
                        '<span class="bSuffix">' + elements[2] + '</span>'
                    );
                })
                .join(' <=> ')
            );
            pWidth[nParts] = Math.max(pWidth[nParts], partWidth);
            formattedLines.push(
                '<p class="' + bClass + '"' + bAttribs + '>' + line + '</p>'
            );
            if (!(flags & SKIP)) {
                beitNo++;                                                       // Increment to next beitNo, and
                poemFormatGrossCounter++;                                       // Count new beit
            }
        }
        for (var i = 0; i < pWidth.length; i++) {
            var bWidth_i = pWidth[i] ? pWidth[i] * i + nGaps[i] * bGap : 0;     // Width to accommodate this number/width of parts
            bWidth = Math.max(bWidth, bWidth_i);                                // Accommodate the widest
        }
        formattedLines = (
            formattedLines
            .join('')                                                           // Concatenate
            .replace(/\s*<sup>\+<\/sup>/g, function() {                         // Restore saved titles
                return '<sup title="' + ftntTitles.shift() + '">+</sup>';
            })
        );
        if ((flags & WIDTH_LOCAL) || (paramsLocal.bWidthMin)) {
            return dimPlcHldrRstr(formattedLines, bWidth, staggered);           // Immediately restore dimension placeholders computed for this block
        }
        else {
            bWidthGlobal = Math.max(bWidth, bWidthGlobal);                      // Update global maximum width
            staggeredGlobal = staggeredGlobal || staggered;
            return formattedLines;                                              // Defer dimension placeholder replacement to the end
        }
    }
    // =========================================================================
    // Auxiliary functions
    // =========================================================================
    // -------------------------------------------------------------------------
    // Escape special characters in strings used to build RegExp
    // -------------------------------------------------------------------------
    function escRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');                   // $& means the whole matched string
    }
    // -------------------------------------------------------------------------
    // Replace Western Arabic digits by Eastern Arabic (٠١٢٣٤٥٦٧٨٩)
    // -------------------------------------------------------------------------
    function west2eastDigits(input) {
        return input.replace(/\d/g, function(match) {
            return String.fromCharCode(parseInt(match, 10) + 0x0660);
        });
    }
    // -------------------------------------------------------------------------
    // Function to replace digits to use Hindi Arabic (٠١٢٣٤٥٦٧٨٩)
    // -------------------------------------------------------------------------
    function east2westDigits(input) {
        return input.replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(match) {
            return String.fromCharCode(match.charCodeAt(0) - 0x0660 + 48);
        });
    }
    // -------------------------------------------------------------------------
    // Extract parameters and return flags from a comma-separated list
    // -------------------------------------------------------------------------
    function getData(list, params) {
        var flags = 0;
        list
        .split(/[,،]/)                                                          // Split into array of entries
        .forEach(function(entry) {                                              // Process each entry
            entry = entry.trim();
            var keyVal;
            if (FLAGS.hasOwnProperty(entry)) {                                  // If a valid flag key
                flags ^= FLAGS[entry];                                          // Set the flag bit
            }
            else if (keyVal = entry.match(/(.*?)\s*=\s*(.*)/)) {                // Extract key-value pairs
                if (DATA_LABELS.hasOwnProperty(keyVal[1])) {
                    var key = DATA_LABELS[ keyVal[1] ];                         // Translate to english name for easier code writing
                    var value = keyVal[2];
                    if (typeof params[key] === "number") {
                        value = parseInt(east2westDigits(keyVal[2])) || 0;
                    }
                    params[key] = value;
                }
            }
        });
        if (flags & MUSDAR) {
            flags |= SINGLE_COLUMN;                                             // Musdar implies single column
            if (!params.bWidthMin) {                                            // And unless explicitly specified,
                params.bWidthMin = MUSDAR_WIDTH;                                // Musdar also implies a width, unless explicitly set
            }
        }
        return flags;
    }
    // -------------------------------------------------------------------------
    // Measure displayed width of an HTML text
    // -------------------------------------------------------------------------
    function measureTextWidth(text) {
        var tmpSpan = document.createElement("span");
        tmpSpan.style.font = fontStyle;                                         // Apply the font style
        tmpSpan.style.position = "absolute";
        tmpSpan.style.visibility = "hidden";
        tmpSpan.style.whiteSpace = "nowrap";
        tmpSpan.innerHTML = text;

        document.body.appendChild(tmpSpan);
        var textWidth = tmpSpan.offsetWidth;
        document.body.removeChild(tmpSpan);

        return textWidth;
    }
    // -------------------------------------------------------------------------
    // Apply flags, which is called separately for blocks and footnotes
    // -------------------------------------------------------------------------
    function flagsApply(text) {
        if (flags & SMART_QUOTES) {
            text = (
                text
                .replace(/"(.*?)"/g, '”$1“')                                    // Replace straight codes by smart quotes if instructed
                .replace(
                    /<.*?>/g,                                                   // Locate tags
                    function(match) { return match.replace(/[”“]/g, '"'); }     // Restore straight quotes
                )
            );
        }
        if (flags & HYPHENS2DASH) {                                             // Replace -- and --- by em and en dashes
            text = (
                text
                .replace(/-{4,}/g, function(s) {return s.replace(/-/g, 'ة');})  // Temporarily replace sequences of 4+ hyphens
                .replace(/---/g, '—')                                           // Replace triple hyphens with an em dash
                .replace(/--/g, '–')                                            // Replace double hyphens with an en dash
                .replace(/ة{4,}/g, function(s) {return s.replace(/ة/g, '-');})  // Restore 4+ hyphens
            );
        }
        return text;
    }
    // -------------------------------------------------------------------------
    // Restore footnotes at placeholders
    // -------------------------------------------------------------------------
    function ftntLblsRstr(str) {
        return (
            str
            .replace(/<\+>/g, '<sup>+</sup>')
            .replace(
                /<\*>/g,
                function(match) {
                    return '<sup>' + ftntLabels.shift() + '</sup>';
                }
            )
        );
    };
    // -------------------------------------------------------------------------
    // Restore dimensions at placeholders
    // -------------------------------------------------------------------------
    function dimPlcHldrRstr(txt, bWidth, staggered) {
        var pWidth = [1, 1, 2, 3, 4, 5].map(function(entry, index) {            // Compute part widths based on whole width
            return (bWidth - nGaps[index] * bGap) / entry;
        });
        if ((flags & WRAP) && (bWidth > bWidthMax)) { staggered = true; }       // Split too long parts over rows
        var actualPartSeparator = (
            staggered ?
            '<span class="bStaggerOffset"></span><br>' +                        // Add an offsetting space after first half
            '<span class="bStaggerOffset">    </span>'                          // and before second half, and include staggering spaces
            : '<span class="bGap">    <\/span>'                                 // Otherwise, make a fixed-width gap with white spaces
        );
        var hWidth = staggered ? pWidth[2] : bWidth;                            // Horizontal line width = beit width, but only single part width when staggered
        return (
            txt
            .replace(/ <=> /g, actualPartSeparator)
            .replace(/%pWidth(\d+)%/g, function(match, i) {                     // Replace computed part widths
                return pWidth[i].toFixed(1);
            })
            .replace(/%bWidth%/g, bWidth)                                       // Replace computed overall beit width
            .replace(/%hWidth%/g, hWidth)                                       // Replace computed overall beit width
        );
    };

    // =========================================================================
    // Main
    // =========================================================================
    // -------------------------------------------------------------------------
    // Extract referenced footnotes
    // -------------------------------------------------------------------------
    for (var found = true; found; ) {
        found = false;
        lines = (
            lines
            .replace(
                /\((\d+|[٠١٢٣٤٥٦٧٨٩]+|[*+])\)([\s\S]*?)\n? *\(\1([^)][\s\S]*?)\1\)/,    // Find a parenthesized label, e.g., "(1)", and the first matching "(1 delimited text 1)"
                function(match, label, textBetween, content) {
                    found = true;
                    content = flagsApply(content.trim());                       // Remove surrounding white space and apply option flags
                    if (label === '+') {                                        // A '+' label is reserved for in-place notes displayed as titles
                        ftntTitles.push(content);
                        return '<+>' + textBetween;                             // A placeholder for in-place footnotes, distinct from '+' characters that may exist in the text
                    }
                    else {                                                      // A regular referenced footnote
                        if (label === '0' || label === '٠') {                   // A label of '0' or '٠' is reserved for auto numbering
                            label = (ftntLabels.length + 1).toString();         // Explicit conversion to string is needed by west2eastDigits
                        }
                        label = west2eastDigits(label);                         // Use Eastern-Arabic numbers
                        ftntReferenced.push(
                            '<p>(' + label + ') ' + content + '</p>'
                        );
                        ftntLabels.push(label);
                        return '<*>' + textBetween;                             // A placeholder for gutter footnotes
                    }
                }
            )
            .replace(/\s*(<[*+]>)/g, '$1')                                      // Stick notes labels to preceding text
        );
    }
    // -------------------------------------------------------------------------
    // Extract standalone footnotes.
    // Even though they are displayed above referenced notes, we collect
    // them later to give the user the chance to include referenced footnotes
    // content within the standalone footnotes
    // -------------------------------------------------------------------------
    lines = lines.replace(
        /\n? *\(!([\s\S]*?)!\) */g,                                             // We remove all preceding white space, including a single line break, if any
        function(match, content) {
            if (content) {                                                      // To support empty comments placeholders by users
                content = flagsApply(content.trim());                           // Remove surrounding white space after removing the delimiters, and apply option flags
                if (!/<p/.test(content)) {                                      // Loose text?
                    content = '<p>' + content + '</p>';                         // Enclose in a paragraph container
                }
                ftntStandalone.push(content);                                   // Append to footnotes
            }
            return '';
        }
    );
    ftntStandalone = ftntStandalone.join('');
    ftntReferenced = ftntReferenced.join('');
    var footnotes = (
        ftntStandalone
        + ((ftntStandalone && ftntReferenced) ? '<hr>' : '') +
        ftntReferenced
    );
    // -------------------------------------------------------------------------
    // Process filtered lines an restore placeholders
    // -------------------------------------------------------------------------
    lines = (
        lines
        .split(/((?:^|\n) *\+{3,}.*?\n)/)                                       // Split into sections of similar columns
        .map(formatLines)                                                       // Format each section into columns
        .join('')                                                               // Join back
    );
    lines = dimPlcHldrRstr(lines, bWidthGlobal, staggeredGlobal);               // Restore dimension placeholders

    var formattedPoem = (
        '<div class="' + classList + '"' + attribs + '>'
        + lines  +
        '</div>'
    );
    if (footnotes) {
        formattedPoem += '<div class="poemGutter">' + footnotes + '</div>'
    }
    return formattedPoem;
}
