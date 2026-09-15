; Forked from tree-sitter-javascript's locals, extended for DekaScript.

; Scopes
;-------

[
  (statement_block)
  (function_expression)
  (arrow_function)
  (function_declaration)
  (method_definition)
  (fn_declaration)
  (receiver_method_declaration)
  (fn_expression)
  (match_expression)
] @local.scope

; Definitions
;------------

(pattern/identifier) @local.definition

(variable_declarator
  name: (identifier) @local.definition)

(required_parameter (identifier) @local.definition)
(optional_parameter (identifier) @local.definition)

; DekaScript definitions

(fn_declaration
  name: (identifier) @local.definition)

(receiver_method_declaration
  name: (identifier) @local.definition)

(struct_declaration
  name: (type_identifier) @local.definition)

(enum_declaration
  name: (type_identifier) @local.definition)

(interface_declaration
  name: (type_identifier) @local.definition)

(type_alias_declaration
  name: (type_identifier) @local.definition)

(match_arm
  pattern: (constructor_pattern
    payload: (identifier) @local.definition))

; References
;------------

(identifier) @local.reference
