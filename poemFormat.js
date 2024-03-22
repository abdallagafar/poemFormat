// =============================================================================
// Format contents of a container (e.g., div) as a poem
// 2024-02-26: First created by Abdalla G. M. Ahmed
// =============================================================================

function poemFormat(poem) {
    // -------------------------------------------------------------------------
    // Auxiliary functions
    // -------------------------------------------------------------------------
    // Function to escape special characters in strings used to build RegExp
    // -------------------------------------------------------------------------
    function escRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');                   // $& means the whole matched string
    }
    // -------------------------------------------------------------------------
    // Function to replace digits to use Hindi Arabic (٠١٢٣٤٥٦٧٨٩)
    // -------------------------------------------------------------------------
    function arabic2hindi(input) {
        return input.replace(/\d/g, function(match) {
            return String.fromCharCode(parseInt(match, 10) + 0x0660);
        });
    }
    // -------------------------------------------------------------------------
    // Retrieve font specs
    // -------------------------------------------------------------------------
    var computedStyle = window.getComputedStyle(poem);
    var fontStyle = [
    computedStyle.fontStyle,
    computedStyle.fontVariant,
    computedStyle.fontWeight,
    computedStyle.fontSize,
    computedStyle.fontFamily
    ].join(' ');
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
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    const FREE = 1;                                                             // Free (non-column) style
    const SINGLE_COLUMN = 2;                                                    // Enforce a single column, for musdar, e.g.
    const SMART_QUOTES = 4;                                                     // Replace straight quotes by smart quotes
    const LTR = 8;                                                              // Set text direction to left-to-right
    const WRAP = 16;                                                            // Wrap wide verses between lines
    const HYPHENS2DASH = 32;                                                    // Replace --- by mdash — and -- by ndash –
    const DEFAULT_OPTIONS = SMART_QUOTES + WRAP + HYPHENS2DASH;
    // -------------------------------------------------------------------------
    // Variables
    // -------------------------------------------------------------------------
    var bWidth0 = parseFloat(poem.getAttribute('data-width') || 0);             // Initial overall width of beit
    var emphasizeAll = parseInt(poem.getAttribute('data-emph') || 0);
    var options = parseInt(poem.getAttribute('data-options') || 0);             // Justify, split parts, use Smart quotes
    options ^= DEFAULT_OPTIONS;                                             // User options are merged with defaults rather than replace them
    console.log(DEFAULT_OPTIONS);
    var attribs = poem.getAttribute('data-attribs') || '';                      // Attributes passed to the div.
    if (options & LTR) attribs += ' dir="LTR"';
    var classList = poem.getAttribute('data-classList') || '';
    if (classList) classList = ' ' + classList;                             // Insert a space to offset from default class
    var lines = (
        poem
        .innerHTML                                                              // We get the HTML to retain inline tags <a,i,b,s,u>
        .replace(/<\/p><p>/gi, '<br>\n')                                        // Undo wiki removal of single empty lines
        .replace(/\s*<(p|div|pre)[^>]*>/gi, '')                                 // Remove opening container tags and preceding whitespace
        .replace(/<\/(p|div|pre)>/gi, '')                                       // Remove closing tags
        .replace(/\s*<hr[^>]*>\s*/gi, '\n----\n')                               // Replace <hr> in wiki with our symbol for an <hr>
        .replace(/<br>/gi, '\n')                                                // Replace line break tags with line-break characters
        .trim()                                                                 // Remove leading and trailing empty lines so that the enclosing <div> tag may be placed in separate lines
    );
    // -------------------------------------------------------------------------
    // Replace straight codes by smart quotes if instructed
    // -------------------------------------------------------------------------
    if (options & SMART_QUOTES) {
        lines = (
            lines
            .replace(/"(.*?)"/g, '”$1“')
            .replace(
                /<.*?>/g,                                                       // Locate tags
                function(match) { return match.replace(/[”“]/g, '"'); }         // Restore straight quotes
            )
        );
    }
    // -------------------------------------------------------------------------
    // Replace -- and --- by em and en dashes
    // -------------------------------------------------------------------------
    if (options & HYPHENS2DASH) {
        lines = (
            lines
            .replace( /-{4,}/g, function(s) { return s.replace(/-/g, 'ة'); })   // Temporarily replace sequences of 4+ hyphens
            .replace(/---/g, '—')                                               // Replace triple hyphens with an em dash
            .replace(/--/g, '–')                                                // Replace double hyphens with an en dash
            .replace( /ة{4,}/g, function(s) { return s.replace(/ة/g, '-'); })   // Restore 4+ hyphens
        );
    }
    // -------------------------------------------------------------------------
    // Extract referenced footnotes
    // -------------------------------------------------------------------------
    var ftntTitles = [];                                                        // Array to hold the contents of in-place notes.
    var ftntReferenced = [];                                                    // Referenced footnotes
    var ftntStandalone = [];                                                    // Standalone footnotes
    var ftntLabels = [];                                                        // Array to save footnote labels during processing
    for (var found = true; found; ) {
        found = false;
        lines = lines.replace(
            /\((\d+|[٠١٢٣٤٥٦٧٨٩]+|[*+])\)([\s\S]*?)\n? *\(\1([^)][\s\S]*?)\1\)/, // Find a parenthesized label, e.g., "(1)", and the first matching "(1 delimited text 1)"
            function(match, label, textBetween, content) {
                found = true;
                if (label === '+') {                                            // A '+' label is reserved for in-place notes displayed as titles
                    ftntTitles.push(content.trim());
                    return '<+>' + textBetween;                                 // A placeholder for in-place footnotes, distinct from '+' characters that may exist in the text
                }
                else {                                                          // A regular referenced footnote
                    if (label === '0' || label === '٠') {                       // A label of '0' or '٠' is reserved for auto numbering
                        label = (ftntLabels.length + 1).toString();             // Explicit conversion to string is needed by arabic2hindi
                    }
                    label = arabic2hindi(label);                                // Use Eastern-Arabic numbers
                    ftntReferenced.push(
                        '<p>(' + label + ') ' + content.trim() + '</p>'
                    );
                    ftntLabels.push(label);
                    return '<*>' + textBetween;                                 // A placeholder for gutter footnotes
                }
            }
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
                                  content = content.trim();                                       // Remove surrounding white space after removing the delimiters
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
    // Define a restoration function
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
    // =========================================================================
    // Format a block of preprocessed poem lines
    // =========================================================================
    function formatLines(lines) {
        const bGap = 50;                                                        // This is twice the sum of widths of bPrefix and bSuffix in CSS
        const bStaggerOffset = 75;                                              // Should match CSS
        const bWidthMax = 450;                                                  // This should match the CSS declaration of the width of poemBody div less padding and bPrefix/bSuffix width
        const elementSeparator = '<->';                                         // A placeholder for separating identified parts during processing
        const partSeparator = '<=>';                                            // A placeholder for separating prefix/body/suffix of a part
        const titlePlcHldr = '<+>';                                             // A placeholder for in-place footnotes, distinct from '+' characters that may exist in the text
        const ftntPlcHldr = '<*>';                                              // A placeholder for gutter footnotes
        var bWidth = bWidth0;                                                   // Initial bWidth
        var pWidth = [0, 0, 0, 0, 0, 0];                                        // Widths of part for different number of parts, index 0 is used for centered verses
        var nGaps  = [2, 0, 1, 2, 3, 4];                                        // Number of gaps for different number of parts, initially assuming no leading gaps
        var staggered = false;                                                  // Whether the poem is fed as one half per line, indenting second halves
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
            if (emphasizeAll) bClass += ' bEmph';
            if (line.match(/\+\+$/)) {                                          // A line ending with "++" is emphasized
                if (!emphasizeAll) { bClass += ' bEmph' };
                line = line.slice(0, -2).trim();                                // Remove the symbols and preceding spaces
            }
            line = line.trim();                                                 // Remove white space around
            var nParts =  0;                                                    // Number of parts
            if (line === "") {                                                  // Empty line?
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
                formattedLines.push(
                    '<p class="bComment">'                                      // Enclose in a comment paragraph
                    + ftntLblsRstr(line.substring(1))                           // Remove delimiter and restore footnote labels, if any
                    + '</p>'
                );
                continue;                                                       // Next!
            }
            else if (line == "...") {                                           // Formatted as vertical ellipses
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
                nParts++;                                                       // To process as a half or two rather than a one
                // No continue here, process normally as a beit.
            }
            else if (line.match(/^\..*[^ .].*\.$/)) {                           // Excluding the two-dots, lines delimited by dots are centered.
                line = line.substring(1, line.length - 1).trim();               // Remove delimiters and any white space
                pWidth[0] = Math.max(pWidth[0], measureTextWidth(line));
                formattedLines.push(
                    '<p class="' + bClass + '">'
                    + '<span class="bJustified">'
                    + line
                    + '</span>'
                    + '</p>'
                );
                continue;                                                       // Next
            }
            // -----------------------------------------------------------------
            // Now we are left with actual lines of the poem
            // -----------------------------------------------------------------
            // Collect inline tags and replace with all-symbols
            // placeholders to enable correct splitting of prefixes and suffixes
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
                (options & SINGLE_COLUMN) ?                                     // Single column requested?
                ([line]) :                                                      // Insert whole line as a single part, otherwise:
                (line.split(/\s{2,}/))                                          // Split at two or more spaces
            );
            // -----------------------------------------------------------------
            // For each part:
            // -----------------------------------------------------------------
            line = (
                line
                .map(function(part) {
                    part = (
                        part
                        .replace(/</g, ' <').replace(/>/g, '> ')                // Offset tags from words to isolate words
                        .replace(/\.{2,}/g, function(match) {                   // Capture ellipses ".."
                            return match.replace(/\./g, 'ة')                    // Replace dots by meaningless letter placeholders "ةة"
                        })
                    );
                    var elements = part.match(
                        /^ *{(.*?)} *{(.*?)} *{(.*?)} *$/                       // Try user-specified splitting
                    );
                    if (!elements) {                                            // If not provided, try the default automatic splitting
                        elements = (
                            part
                            .match(                                             // Split into three elements: punctuation/core/punctuation
                                /^([^\u0620-\u064Aa-zA-Z]*)([\u0620-\u064Aa-zA-Z].*[\u0620-\u065Fa-zA-Z])([^\u0620-\u065Fa-zA-Z]*)$/
                                /*(      non-letters      )(    First letter     --    Last letter      )(      non-letters      )*/
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
                    .split(/\s+/)                                           // Split at white spaces
                    .map(function(item) {
                        if (/^<.*>$/.test(item)) { return item; }           // Return tag placeholders as is
                        return '<span>' + item + '</span>';                 // Enclose each word in a span to enable justification
                    })
                    .join(' ')                                               // Join all items back
                    .replace(
                        /(<\/span>)\s*(<[+*]>)/g, '$2$1'                    // Move superscripts inside word spans
                    )
                    );
                    return elements.join(' ' + elementSeparator + ' ');         // A separator mark between elements, with spaces to offset from words
                })
                .join(' ' + partSeparator + ' ')                                // A separator mark between parts
            );
            // -----------------------------------------------------------------
            // Distribute tags over words so that they can be split properly
            // between parts/elements
            // The order we collected the tags makes the innermost nested tags
            // processed first, hence nest them properly
            // -----------------------------------------------------------------
            tags.map(function(tag, i) {                                         // For the ith tag ..
                line = line.replace(
                    new RegExp('<' + i + '>(.*)</' + i + '>'),                  // Find the enclosed text
                                    function(match, content) {
                                        return (
                                            content                                             // Content inside tag
                                            .trim()                                             // Remove leading/trailing spaces
                                            .split(/\s+/)                                       // Split at white space and include white spaces in the list
                                            .map(function(item) {
                                                if (/<[-=]>/.test(item)) {
                                                    return ' ' + item + ' ';                    // Return part/element separators as is, but keep spaces around
                                                }
                                                return '<' + i + '>' + item + '</' + i + '>';   // Enclose contiguous non-white space in tag
                                            })
                                            .join(' ')                                          // Join all items back together
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
                .split(' ' + partSeparator + ' ')
                .map(function(part) {
                    nParts++;                                                   // Increment number of parts to count this one
                    part = ftntLblsRstr(part);
                    var elements = part.split(' ' + elementSeparator + ' ');
                    elements[1] = elements[1].replace(
                        /(<\/span>)\s*(<sup>.*?<\/sup>)/g, '$2$1'               // Move superscripts inside word spans
                    );
                    // ---------------------------------------------------------
                    partWidth = Math.max(
                        partWidth, measureTextWidth(elements[1], fontStyle)     // Update longest part length
                    );
                    return (
                        '<span class="bPrefix">' + elements[0] + '</span>' +
                        '<span class="bJustified" style="width:%pWidth%px">'
                        + elements[1] +
                        '</span>' +
                        '<span class="bSuffix">' + elements[2] + '</span>'
                    );
                })
                .join('<=>')
                .replace(/%pWidth%/g, '%pWidth' + nParts + '%')                 // The number of parts is known now
            );
            pWidth[nParts] = Math.max(pWidth[nParts], partWidth);
            formattedLines.push('<p class="'+bClass+'">' + line + '</p>');
        }
        for (var i = 0; i < pWidth.length; i++) {
            var bWidth_i = pWidth[i] ? pWidth[i] * i + nGaps[i] * bGap : 0;     // Width to accommodate this number/width of parts
            bWidth = Math.max(bWidth, bWidth_i);                                // Accommodate the widest
        }
        pWidth = pWidth.map(function(w, i) {
            return (bWidth - nGaps[i] * bGap) / (i ? i : 1);
        });
        if ((options & WRAP) && (bWidth > bWidthMax)) { staggered = true; }     // Split too long parts over rows
        var actualPartSeparator = (
            staggered?
            '<span class="bStaggerOffset"></span><br>' +                        // Add an offsetting space after first half
            '<span class="bStaggerOffset">    </span>'                          // and before second half, and include staggering spaces
            : '<span class="bGap">    <\/span>'                                 // Otherwise, make a fixed-width gap with white spaces
        );
        var hWidth = staggered ? pWidth[2] + bStaggerOffset : bWidth;           // Horizontal line width, default beit width, but only single part width when staggered
        return (
            formattedLines
                .join('')                                                           // Concatenate
                .replace(/<=>/g, actualPartSeparator)
                .replace(/%pWidth(\d+)%/g, function(match, i) {                     // Replace computed part widths
                    return pWidth[i].toFixed(1);
                })
                .replace(/\s*<sup>/g, '<sup>')                                      // Stick notes labels to preceding text
                .replace(/\s*<sup>\+<\/sup>/g, function() {                         // Restore saved titles
                    return '<sup title="' + ftntTitles.shift() + '">+</sup>';
                })
                .replace(/%bWidth%/g, bWidth)                                       // Replace computed overall beit width
                .replace(/%hWidth%/g, hWidth)                                       // Replace computed overall beit width
        );
    }
    // =========================================================================
    // End of block formatting function
    // =========================================================================

    if (options & FREE) {                                                       // Modern free poetry
        lines = (
            '<p class="bFree">' +                                               // Open first paragraph
            ftntLblsRstr(lines)                                                 // Restore footnote labels
            .split(/\r?\n/)                                                     // Split at line breaks
            .join('</p><p class="bFree">')                                      // Enclose each line as a <p> node
            + '</p>'                                                            // Close last paragraph
        );
    }
    else {                                                                      // Classic poetry
        lines = (
            lines
            .split(/\n *\+{3,} *\n/)                                            // Split into sections of similar columns
            .map(formatLines)                                                   // Format each section into columns
            .join('')                                                           // Join back
        );
    }
    var formattedPoem = (
        '<div class="poemBody' + classList + '" ' + attribs + '>'
        + lines  +
        '</div>'
    );
    if (footnotes) {
        formattedPoem += '<div class="poemGutter">' + footnotes + '</div>'
    }
    return formattedPoem;
}
