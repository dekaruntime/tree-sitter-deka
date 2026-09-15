; Forked from tree-sitter-javascript's tags query.

(function_declaration name: (identifier) @name) @definition.function

(generator_function_declaration
  name: (identifier) @name) @definition.function

(fn_declaration name: (identifier) @name) @definition.function

(receiver_method_declaration
  name: (identifier) @name) @definition.method

(class_declaration
  name: (type_identifier) @name) @definition.class

(struct_declaration
  name: (type_identifier) @name) @definition.class

(enum_declaration
  name: (type_identifier) @name) @definition.class

(interface_declaration
  name: (type_identifier) @name) @definition.interface

(type_alias_declaration
  name: (type_identifier) @name) @definition.type

(method_definition
  name: (property_identifier) @name) @definition.method

(interface_method_signature
  name: (property_identifier) @name) @definition.method

(call_expression
  function: [
    (identifier) @name
    (member_expression
      property: (property_identifier) @name)
  ]) @reference.call

(bridge_expression
  kind: (identifier) @name
  action: (identifier) @name) @reference.call
