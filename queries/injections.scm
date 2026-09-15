; Forked from tree-sitter-javascript's injections, plus DekaScript-specific
; injections.

; Parse the contents of tagged template literals using
; a language inferred from the tag.

(call_expression
  function: [
    (identifier) @injection.language
    (member_expression
      property: (property_identifier) @injection.language)
  ]
  arguments: (template_string (string_fragment) @injection.content)
  (#set! injection.combined)
  (#set! injection.include-children))


; Parse regex syntax within regex literals

((regex_pattern) @injection.content
 (#set! injection.language "regex"))

 ; Parse JSDoc annotations in comments

((comment) @injection.content
 (#set! injection.language "jsdoc"))

; DEKA-SPECIFIC: the body of an `unsafe { ... }` block is raw JavaScript
; (dsc hands it to the JS runtime verbatim), so inject the JavaScript
; grammar for highlighting and analysis.

((raw_js) @injection.content
 (#set! injection.language "javascript"))
