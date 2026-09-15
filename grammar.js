/**
 * Tree-sitter grammar for DekaScript (.ds) and DSX (.dsx).
 *
 * Forked from tree-sitter-typescript (tsx dialect) at commit
 * 75b3874edb2dc714fb1fd77a32013f0d8699989f, which itself builds on
 * tree-sitter-javascript 0.23.1. See README.md "Fork lineage" for what was
 * removed and added relative to upstream.
 *
 * The structure of this file mirrors common/define-grammar.js from
 * tree-sitter-typescript (`grammar(JavaScript, { ... })` with dialect-wide
 * overrides), with a clearly delimited DEKA-SPECIFIC section at the bottom of
 * `rules`.
 */

const JavaScript = require('tree-sitter-javascript/grammar');

module.exports = grammar(JavaScript, {
  name: 'deka',

  externals: ($, previous) => previous.concat([
    $._function_signature_automatic_semicolon,
    $.__error_recovery,
    // DekaScript: raw JavaScript body of an `unsafe { ... }` block, scanned
    // as a single opaque token by the external scanner (see scanner/scanner.h).
    $.raw_js,
  ]),

  supertypes: ($, previous) => previous.concat([
    $.type,
    $.primary_type,
  ]),

  precedences: ($, previous) => previous.concat([
    [
      'call',
      'instantiation',
      'unary',
      'binary',
      $.await_expression,
      $.arrow_function,
    ],
    [
      'extends',
      'instantiation',
    ],
    [$.accessibility_modifier, $.primary_expression],
    ['unary_void', $.expression],
    [$.extends_clause, $.primary_expression],
    ['unary', 'assign'],
    ['declaration', $.expression],
    [$.predefined_type, $.unary_expression],
    [$.as_expression, $.satisfies_expression, $.primary_type],
    [$.override_modifier, $.primary_expression],
    [$.decorator_call_expression, $.decorator],
    [$.predefined_type, $.pattern],
    [$.new_expression, $.primary_expression],
    [$.meta_property, $.primary_expression],
  ]),

  conflicts: ($, previous) => previous.concat([
    [$.call_expression, $.instantiation_expression, $.binary_expression],
    [$.call_expression, $.instantiation_expression, $.binary_expression, $.unary_expression],
    [$.call_expression, $.instantiation_expression, $.binary_expression, $.update_expression],
    [$.call_expression, $.instantiation_expression, $.binary_expression, $.await_expression],

    // This appears to be necessary to parse a parenthesized class expression
    [$.class],

    [$.nested_identifier, $.nested_type_identifier, $.primary_expression],
    [$.nested_identifier, $.nested_type_identifier],
    [$.nested_identifier, $.nested_type_identifier, $.primary_type],


    [$.primary_expression, $._parameter_name],
    [$.primary_expression, $._parameter_name, $.primary_type],
    [$.primary_expression, $.primary_type],
    [$.primary_expression, $.generic_type],
    [$.primary_type, $.generic_type],
    [$.primary_expression, $.predefined_type],
    [$.primary_expression, $.pattern, $.primary_type],
    [$._parameter_name, $.primary_type],
    [$.pattern, $.primary_type],


    [$.object, $.object_pattern, $._property_name],



    // DEKA-SPECIFIC: tsx dialect conflicts
    [$.jsx_opening_element, $.type_parameter],
    [$.jsx_namespace_name, $.primary_type],

    // DEKA-SPECIFIC: `fn` declarations vs `fn` expressions, receiver
    // methods, struct literals in expression position, and match arm
    // patterns that can look like expressions.
    [$.type, $.option_type],
    [$.struct_literal, $.match_expression],
    [$.primary_expression, $.struct_literal],
    [$.match_arm, $.call_expression],
    [$.primary_expression, $.unwrap_expression],
    [$.fn_declaration, $.fn_expression],
    [$.fn_declaration, $.fn_expression, $.deka_function_type],
    [$.receiver_method_declaration, $.fn_expression],
    [$.receiver_method_declaration, $.fn_expression, $.deka_function_type],
    [$.match_expression, $.struct_literal],
    [$.struct_literal, $.statement_block],
    [$.match_arm, $.binary_expression],
    [$.match_arm, $.binary_expression, $.struct_literal],
    [$.match_arm, $.call_expression, $.struct_literal],
    [$.match_arm, $.struct_literal],
    [$.match_arm, $.member_expression],
    [$.match_arm, $.await_expression],
  ]),

  inline: ($, previous) => previous
    .filter((rule) => ![
      '_formal_parameter',
      '_call_signature',
    ].includes(rule.name))
    .concat([
      $._type_identifier,
      $._jsx_start_opening_element,
    ]),

  rules: {
    // === Overrides inherited verbatim from tree-sitter-typescript (tsx
    // dialect). Keep in sync with common/define-grammar.js. ===

    public_field_definition: $ => seq(
      repeat(field('decorator', $.decorator)),
      optional(choice(
        seq('declare', optional($.accessibility_modifier)),
        seq($.accessibility_modifier, optional('declare')),
      )),
      choice(
        seq(optional('static'), optional($.override_modifier), optional('readonly')),
        seq(optional('abstract'), optional('readonly')),
        seq(optional('readonly'), optional('abstract')),
        optional('accessor'),
      ),
      field('name', $._property_name),
      optional(choice('?', '!')),
      field('type', optional($.type_annotation)),
      optional($._initializer),
    ),

    // override original catch_clause, add optional type annotation
    catch_clause: $ => seq(
      'catch',
      optional(
        seq(
          '(',
          field(
            'parameter',
            choice($.identifier, $._destructuring_pattern),
          ),
          optional(
            // only types that resolve to 'any' or 'unknown' are supported
            // by the language but it's simpler to accept any type here.
            field('type', $.type_annotation),
          ),
          ')',
        ),
      ),
      field('body', $.statement_block),
    ),

    call_expression: $ => choice(
      prec('call', seq(
        field('function', choice($.expression, $.import)),
        field('type_arguments', optional($.type_arguments)),
        field('arguments', $.arguments),
      )),
      prec('template_call', seq(
        field('function', choice($.primary_expression, $.new_expression)),
        field('arguments', $.template_string),
      )),
      prec('member', seq(
        field('function', $.primary_expression),
        '?.',
        field('type_arguments', optional($.type_arguments)),
        field('arguments', $.arguments),
      )),
    ),

    new_expression: $ => prec.right('new', seq(
      'new',
      field('constructor', $.primary_expression),
      field('type_arguments', optional($.type_arguments)),
      field('arguments', optional($.arguments)),
    )),

    assignment_expression: $ => prec.right('assign', seq(
      optional('using'),
      field('left', choice($.parenthesized_expression, $._lhs_expression)),
      '=',
      field('right', $.expression),
    )),

    _augmented_assignment_lhs: ($, previous) => choice(previous, $.non_null_expression),

    _lhs_expression: ($, previous) => choice(previous, $.non_null_expression),

    primary_expression: ($, previous) => choice(
      previous,
      $.non_null_expression,
      // DEKA-SPECIFIC: DekaScript primary expressions.
      $.match_expression,
      $.struct_literal,
      $.unsafe_expression,
      $.build_expression,
      $.bridge_expression,
      $.fn_expression,
      $.none,
    ),

    // tsx dialect: keep all JavaScript expression members (including JSX);
    // no type_assertion (DekaScript has no `<T>expr` syntax either).
    expression: ($, previous) => choice(
      $.as_expression,
      $.satisfies_expression,
      $.instantiation_expression,
      ...previous.members,
    ),

    _jsx_start_opening_element: $ => seq(
      '<',
      optional(
        seq(
          choice(
            field('name', choice(
              $._jsx_identifier,
              $.jsx_namespace_name,
            )),
            seq(
              field('name', choice(
                $.identifier,
                alias($.nested_identifier, $.member_expression),
              )),
              field('type_arguments', optional($.type_arguments)),
            ),
          ),
          repeat(field('attribute', $._jsx_attribute)),
        ),
      ),
    ),

    jsx_opening_element: $ => prec.dynamic(-1, seq(
      $._jsx_start_opening_element,
      '>',
    )),

    jsx_self_closing_element: $ => prec.dynamic(-1, seq(
      $._jsx_start_opening_element,
      '/>',
    )),

    export_specifier: (_, previous) => seq(
      optional(choice('type', 'typeof')),
      previous,
    ),

    _import_identifier: $ => choice($.identifier, alias('type', $.identifier)),

    import_specifier: $ => seq(
      optional(choice('type', 'typeof')),
      choice(
        field('name', $._import_identifier),
        seq(
          field('name', choice($._module_export_name, alias('type', $.identifier))),
          'as',
          field('alias', $._import_identifier),
        ),
      ),
    ),

    import_attribute: $ => seq(choice('with', 'assert'), $.object),

    import_clause: $ => choice(
      $.namespace_import,
      $.named_imports,
      seq(
        $._import_identifier,
        optional(seq(
          ',',
          choice(
            $.namespace_import,
            $.named_imports,
          ),
        )),
      ),
    ),

    import_statement: $ => seq(
      'import',
      optional(choice('type', 'typeof')),
      choice(
        seq($.import_clause, $._from_clause),
        $.import_require_clause,
        field('source', $.string),
      ),
      optional($.import_attribute),
      $._semicolon,
    ),

    export_statement: ($, previous) => choice(
      previous,
      seq(
        'export',
        'type',
        $.export_clause,
        optional($._from_clause),
        $._semicolon,
      ),
      seq('export', '=', $.expression, $._semicolon),
      seq('export', 'as', 'namespace', $.identifier, $._semicolon),
    ),

    non_null_expression: $ => prec.left('unary', seq(
      $.expression, '!',
    )),

    // DEKA-SPECIFIC: adds the unwrap-binding initializer
    // (`const x = unwrap(v) or { ... }`, deka#445). The plain TS variant is
    // kept as the first alternative.
    variable_declarator: $ => choice(
      seq(
        field('name', choice($.identifier, $._destructuring_pattern)),
        field('type', optional($.type_annotation)),
        optional($._initializer),
      ),
      prec('declaration', seq(
        field('name', $.identifier),
        '!',
        field('type', $.type_annotation),
      )),
      seq(
        field('name', $.identifier),
        field('type', optional($.type_annotation)),
        '=',
        field('value', $.unwrap_expression),
      ),
    ),

    method_signature: $ => seq(
      optional($.accessibility_modifier),
      optional('static'),
      optional($.override_modifier),
      optional('readonly'),
      optional('async'),
      optional(choice('get', 'set', '*')),
      field('name', $._property_name),
      optional('?'),
      $._call_signature,
    ),

    abstract_method_signature: $ => seq(
      optional($.accessibility_modifier),
      'abstract',
      optional($.override_modifier),
      optional(choice('get', 'set', '*')),
      field('name', $._property_name),
      optional('?'),
      $._call_signature,
    ),

    parenthesized_expression: $ => seq(
      '(',
      choice(
        seq($.expression, field('type', optional($.type_annotation))),
        $.sequence_expression,
      ),
      ')',
    ),

    _formal_parameter: $ => choice(
      $.required_parameter,
      $.optional_parameter,
    ),

    function_signature: $ => seq(
      optional('async'),
      'function',
      field('name', $.identifier),
      $._call_signature,
      choice($._semicolon, $._function_signature_automatic_semicolon),
    ),

    decorator: $ => seq(
      '@',
      choice(
        $.identifier,
        alias($.decorator_member_expression, $.member_expression),
        alias($.decorator_call_expression, $.call_expression),
        alias($.decorator_parenthesized_expression, $.parenthesized_expression),
      ),
    ),

    decorator_call_expression: $ => prec('call', seq(
      field('function', choice(
        $.identifier,
        alias($.decorator_member_expression, $.member_expression),
      )),
      optional(field('type_arguments', $.type_arguments)),
      field('arguments', $.arguments),
    )),

    decorator_parenthesized_expression: $ => seq(
      '(',
      choice(
        $.identifier,
        alias($.decorator_member_expression, $.member_expression),
        alias($.decorator_call_expression, $.call_expression),
      ),
      ')',
    ),

    class_body: $ => seq(
      '{',
      repeat(choice(
        seq(
          repeat(field('decorator', $.decorator)),
          $.method_definition,
          optional($._semicolon),
        ),
        seq($.method_signature, choice($._function_signature_automatic_semicolon, ',')),
        $.class_static_block,
        seq(
          choice(
            $.abstract_method_signature,
            $.method_signature,
            $.public_field_definition,
          ),
          choice($._semicolon, ','),
        ),
        ';',
      )),
      '}',
    ),

    method_definition: $ => prec.left(seq(
      optional($.accessibility_modifier),
      optional('static'),
      optional($.override_modifier),
      optional('readonly'),
      optional('async'),
      optional(choice('get', 'set', '*')),
      field('name', $._property_name),
      optional('?'),
      $._call_signature,
      field('body', $.statement_block),
    )),

    // DEKA-SPECIFIC: fn/struct/receiver-method declarations join the
    // declaration supertype so `export fn ...` and friends parse through the
    // stock export_statement.
    declaration: ($, previous) => choice(
      previous,
      $.fn_declaration,
      $.receiver_method_declaration,
      $.struct_declaration,
      $.interface_declaration,
      $.enum_declaration,
      $.type_alias_declaration,
    ),

    as_expression: $ => prec.left('binary', seq(
      $.expression,
      'as',
      choice('const', $.type),
    )),

    satisfies_expression: $ => prec.left('binary', seq(
      $.expression,
      'satisfies',
      $.type,
    )),

    instantiation_expression: $ => prec('instantiation', seq(
      $.expression,
      field('type_arguments', $.type_arguments),
    )),

    class_heritage: $ => choice(
      seq($.extends_clause, optional($.implements_clause)),
      $.implements_clause,
    ),

    import_require_clause: $ => seq(
      $.identifier,
      '=',
      'require',
      '(',
      field('source', $.string),
      ')',
    ),

    extends_clause: $ => seq(
      'extends',
      commaSep1($._extends_clause_single),
    ),

    _extends_clause_single: $ => prec('extends', seq(
      field('value', $.expression),
      field('type_arguments', optional($.type_arguments)),
    )),

    implements_clause: $ => seq(
      'implements',
      commaSep1($.type),
    ),

    class: $ => prec('literal', seq(
      repeat(field('decorator', $.decorator)),
      'class',
      field('name', optional($._type_identifier)),
      field('type_parameters', optional($.type_parameters)),
      optional($.class_heritage),
      field('body', $.class_body),
    )),

    abstract_class_declaration: $ => prec('declaration', seq(
      repeat(field('decorator', $.decorator)),
      'abstract',
      'class',
      field('name', $._type_identifier),
      field('type_parameters', optional($.type_parameters)),
      optional($.class_heritage),
      field('body', $.class_body),
    )),

    class_declaration: $ => prec.left('declaration', seq(
      repeat(field('decorator', $.decorator)),
      'class',
      field('name', $._type_identifier),
      field('type_parameters', optional($.type_parameters)),
      optional($.class_heritage),
      field('body', $.class_body),
      optional($._automatic_semicolon),
    )),

    nested_type_identifier: $ => prec('member', seq(
      field('module', choice($.identifier, $.nested_identifier)),
      '.',
      field('name', $._type_identifier),
    )),

    // DEKA-SPECIFIC: DekaScript interfaces have no extends clause and hold
    // DekaScript members (paren-less `fn` method signatures, `mut` fields)
    // instead of TypeScript type members.
    interface_declaration: $ => seq(
      'interface',
      field('name', $._type_identifier),
      field('type_parameters', optional($.type_parameters)),
      field('body', $.interface_body),
    ),

    interface_body: $ => seq(
      '{',
      repeat(choice(
        $.interface_field,
        $.interface_method_signature,
        ',',
        ';',
      )),
      '}',
    ),

    interface_field: $ => seq(
      optional('mut'),
      field('name', choice(
        alias($._reserved_identifier, $.property_identifier),
        alias($.identifier, $.property_identifier),
      )),
      optional('?'),
      ':',
      field('type', $.type),
    ),

    // `fn name(params) ReturnType` — no colon before the return type, no
    // required separator (a newline ends the signature, as in the deka
    // stdlib packages).
    interface_method_signature: $ => seq(
      optional('mut'),
      'fn',
      field('name', choice(
        alias($._reserved_identifier, $.property_identifier),
        alias($.identifier, $.property_identifier),
      )),
      field('parameters', $.formal_parameters),
      field('return_type', optional($.type)),
      choice($._semicolon, $._function_signature_automatic_semicolon),
    ),

    // DEKA-SPECIFIC: DekaScript enums carry payloads (`Case(Type)`) and may
    // be marked `super` (runtime type information, deka#561). Cases are
    // separated by commas, semicolons, or newlines.
    enum_declaration: $ => prec('declaration', seq(
      optional('super'),
      'enum',
      field('name', $._type_identifier),
      field('type_parameters', optional($.type_parameters)),
      '{',
      repeat(choice(
        $.enum_case,
        ',',
        ';',
      )),
      '}',
      optional($._automatic_semicolon),
    )),

    enum_case: $ => seq(
      field('name', choice(
        alias($._reserved_identifier, $.identifier),
        $.identifier,
      )),
      optional(seq(
        '(',
        field('payload', $.type),
        ')',
      )),
    ),

    // DEKA-SPECIFIC: `alias X<T> = Y` (preferred) and deprecated
    // `type X = Y`, plus the newtype form `type Name Repr`.
    type_alias_declaration: $ => prec('declaration', choice(
      seq(
        choice('alias', 'type'),
        field('name', $._type_identifier),
        field('type_parameters', optional($.type_parameters)),
        '=',
        field('value', $.type),
        $._semicolon,
      ),
      seq(
        'type',
        field('name', $._type_identifier),
        field('representation', $._type_identifier),
        $._semicolon,
      ),
    )),

    accessibility_modifier: _ => choice(
      'public',
      'private',
      'protected',
    ),

    override_modifier: _ => 'override',

    required_parameter: $ => seq(
      $._parameter_name,
      field('type', optional($.type_annotation)),
      optional($._initializer),
    ),

    optional_parameter: $ => seq(
      $._parameter_name,
      '?',
      field('type', optional($.type_annotation)),
      optional($._initializer),
    ),

    _parameter_name: $ => seq(
      repeat(field('decorator', $.decorator)),
      optional($.accessibility_modifier),
      optional($.override_modifier),
      optional('readonly'),
      field('pattern', choice($.pattern, $.this)),
    ),

    omitting_type_annotation: $ => seq('-?:', $.type),
    adding_type_annotation: $ => seq('+?:', $.type),
    opting_type_annotation: $ => seq('?:', $.type),
    type_annotation: $ => seq(
      ':',
      $.type,
    ),

    // DEKA-SPECIFIC: DekaScript types are named/generic types, `fn`
    // function types, parenthesized types, unions (`A | B`), and postfix
    // option types (`T?`). TypeScript-only type forms (object/mapped/
    // conditional/tuple/lookup/typeof types, intersections, literal types)
    // were dropped: none of them are producible by dsc's type parser
    // (crates/deka_syntax/src/parse/ty.rs), and dropping them removes the
    // `{`-ambiguity between fn bodies and object types.
    type: $ => $.primary_type,

    primary_type: $ => choice(
      $.parenthesized_type,
      $.predefined_type,
      $._type_identifier,
      $.nested_type_identifier,
      $.generic_type,
      $.union_type,
      $.deka_function_type,
      $.option_type,
    ),

    deka_function_type: $ => prec.left(seq(
      'fn',
      field('parameters', $.formal_parameters),
      field('return_type', $.type),
    )),

    option_type: $ => prec.right('unary', seq($.primary_type, '?')),

    parenthesized_type: $ => seq('(', $.type, ')'),

    predefined_type: _ => choice(
      'any',
      'number',
      'boolean',
      'string',
      'symbol',
      'void',
      'unknown',
      'never',
      'object',
    ),

    generic_type: $ => prec('call', seq(
      field('name', choice(
        $._type_identifier,
        $.nested_type_identifier,
      )),
      field('type_arguments', $.type_arguments),
    )),

    union_type: $ => prec.left(seq(optional($.type), '|', $.type)),

    type_arguments: $ => seq(
      '<',
      commaSep1($.type),
      optional(','),
      '>',
    ),

    type_parameters: $ => seq(
      '<', commaSep1($.type_parameter), optional(','), '>',
    ),

    type_parameter: $ => seq(
      field('name', $._type_identifier),
      field('constraint', optional($.constraint)),
    ),

    constraint: $ => seq(
      ':',
      $.type,
    ),

    _call_signature: $ => seq(
      field('type_parameters', optional($.type_parameters)),
      field('parameters', $.formal_parameters),
      field('return_type', optional($.type_annotation)),
    ),

    _type_identifier: $ => alias($.identifier, $.type_identifier),
    _type_identifier: $ => alias($.identifier, $.type_identifier),

    _reserved_identifier: (_, previous) => choice(
      'declare',
      'namespace',
      'type',
      'public',
      'private',
      'protected',
      'override',
      'readonly',
      'module',
      'any',
      'number',
      'boolean',
      'string',
      'symbol',
      'export',
      'object',
      'new',
      'readonly',
      previous,
    ),

    // === DEKA-SPECIFIC rules (no upstream equivalent) ===

    // `fn name<T: Bound>(params) ReturnType { ... }` — top level and after
    // `export` only in DekaScript; the return type, when present, is a type
    // with NO leading colon (dsc rejects `fn f(): T` declarations).
    fn_declaration: $ => prec.right('declaration', seq(
      optional('async'),
      'fn',
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameters)),
      field('parameters', $.formal_parameters),
      field('return_type', optional($.type)),
      field('body', $.statement_block),
      optional($._automatic_semicolon),
    )),

    // Receiver method: `fn (s Signal<T>) get() T { ... }` (rfd#56).
    receiver_method_declaration: $ => prec.right('declaration', seq(
      optional('async'),
      'fn',
      '(',
      field('receiver_name', $.identifier),
      optional('mut'),
      field('receiver_type', $._type_identifier),
      field('receiver_type_arguments', optional($.type_parameters)),
      ')',
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameters)),
      field('parameters', $.formal_parameters),
      field('return_type', optional($.type)),
      field('body', $.statement_block),
      optional($._automatic_semicolon),
    )),

    // Anonymous function expression: `fn (x: number) number { ... }`. The
    // return type is optional; a colon before it is tolerated (dsc accepts
    // both spellings here).
    fn_expression: $ => prec('literal', choice(
      seq(
        optional('async'),
        'fn',
        field('parameters', $.formal_parameters),
        field('body', $.statement_block),
      ),
      seq(
        optional('async'),
        'fn',
        field('parameters', $.formal_parameters),
        optional(':'),
        field('return_type', $.type),
        field('body', $.statement_block),
      ),
    )),

    // `struct Name<T> { field: Type, other?: Type = default, Embedded }`
    // Fields are separated by newlines, `;`, or (leniently) `,` — the deka
    // stdlib style is newline-separated with no semicolons.
    struct_declaration: $ => prec('declaration', seq(
      optional('super'),
      'struct',
      field('name', $._type_identifier),
      field('type_parameters', optional($.type_parameters)),
      '{',
      repeat(choice(
        $.struct_field,
        $.struct_embed,
        ',',
        ';',
      )),
      '}',
      optional($._automatic_semicolon),
    )),

    struct_field: $ => seq(
      field('name', choice(
        alias($._reserved_identifier, $.property_identifier),
        alias($.identifier, $.property_identifier),
      )),
      optional('?'),
      ':',
      field('type', $.type),
      optional(seq(
        '=',
        field('default', $.expression),
      )),
    ),

    // Embedded struct: `struct Outer { Inner }` — a bare type name.
    struct_embed: $ => field('name', $._type_identifier),

    // `match scrutinee { Pattern => expr, ... }`. Arms are separated by
    // commas, semicolons, or newlines; `|` separates or-patterns.
    match_expression: $ => prec.right(seq(
      'match',
      field('value', $.expression),
      '{',
      repeat(choice(
        $.match_arm,
        ',',
        ';',
      )),
      '}',
    )),

    match_arm: $ => seq(
      field('pattern', sepBy1('|', $._match_pattern)),
      '=>',
      field('body', $.expression),
    ),

    // Unqualified names are bindings (plain identifiers) unless followed by
    // `(`, `.`, or `{` — the same decision dsc's pattern parser makes
    // (crates/deka_syntax/src/parse/pattern.rs). `None` is a constructor.
    _match_pattern: $ => choice(
      $.wildcard_pattern,
      $.constructor_pattern,
      $.struct_pattern,
      $.tuple_pattern,
      $.number,
      $.string,
      $.true,
      $.false,
      $.none,
      $.identifier,
    ),

    wildcard_pattern: _ => '_',

    constructor_pattern: $ => choice(
      seq(
        field('enum', $.identifier),
        '.',
        field('name', $.identifier),
        optional(seq(
          '(',
          optional(field('payload', $._match_pattern)),
          ')',
        )),
      ),
      seq(
        field('name', $.identifier),
        '(',
        optional(field('payload', $._match_pattern)),
        ')',
      ),
    ),

    struct_pattern: $ => seq(
      field('name', $.identifier),
      '{',
      commaSep(seq(
        field('field', $.identifier),
        optional(seq(':', $._match_pattern)),
      )),
      '}',
    ),

    tuple_pattern: $ => seq(
      '(',
      commaSep1($._match_pattern),
      optional(','),
      ')',
    ),

    // Struct literal: `Name { field: expr, ... }` (rfd#56 construction
    // syntax). Field values are single expressions.
    struct_literal: $ => prec('literal', seq(
      field('name', $.identifier),
      '{',
      commaSep(seq(
        field('field', $.identifier),
        ':',
        field('value', $.expression),
      )),
      '}',
    )),

    // `unsafe<T> { raw JavaScript }` — the body is scanned as one opaque
    // token and injected as JavaScript (see queries/injections.scm).
    unsafe_expression: $ => prec('unary', seq(
      'unsafe',
      field('type', optional($.type_arguments)),
      '{',
      optional($.raw_js),
      '}',
    )),

    // `build { ... }` — build-phase DekaScript statement list.
    build_expression: $ => prec('unary', seq(
      'build',
      field('body', $.statement_block),
    )),

    // `bridge kind.action(args)` — host bridge call.
    bridge_expression: $ => prec('call', seq(
      'bridge',
      field('kind', $.identifier),
      '.',
      field('action', $.identifier),
      field('arguments', $.arguments),
    )),

    // `unwrap(scrutinee) or { ... }` / `unwrap(scrutinee) or match { ... }`
    // (deka#445). `unwrap` and `or` stay ordinary identifiers elsewhere.
    unwrap_expression: $ => prec.right(seq(
      'unwrap',
      '(',
      field('value', $._expressions),
      ')',
      'or',
      field('alternative', choice(
        $.statement_block,
        seq('match', $.match_body),
      )),
    )),

    match_body: $ => seq(
      '{',
      repeat(choice(
        $.match_arm,
        ',',
        ';',
      )),
      '}',
    ),

    // The `None` literal (DekaScript's null).
    none: _ => 'None',

    // `unwrap` is a contextual keyword: it opens unwrap_expression after
    // `=`, but must keep working as an ordinary identifier everywhere else
    // (dsc keeps `unwrap` out of the keyword list for this reason). Same
    // trick tree-sitter-javascript uses for `get`/`set`.
    _identifier: $ => choice(
      $.undefined,
      $.identifier,
      alias('unwrap', $.identifier),
    ),

    // DEKA-SPECIFIC: DekaScript binary operators. Bitwise ops (`&`, `|`,
    // `^`, shifts), `instanceof`, and `in` do not exist in DekaScript; the
    // pipe operator `|>` does (same precedence as `&&`).
    binary_expression: $ => choice(
      ...[
        ['||', 'logical_or'],
        ['&&', 'logical_and'],
        ['|>', 'logical_and'],
        ['==', 'binary_equality'],
        ['===', 'binary_equality'],
        ['!=', 'binary_equality'],
        ['!==', 'binary_equality'],
        ['<', 'binary_relation'],
        ['<=', 'binary_relation'],
        ['>=', 'binary_relation'],
        ['>', 'binary_relation'],
        ['+', 'binary_plus'],
        ['-', 'binary_plus'],
        ['*', 'binary_times'],
        ['/', 'binary_times'],
        ['%', 'binary_times'],
        ['**', 'binary_exp', 'right'],
      ].map(([operator, precedence, associativity]) =>
        (associativity === 'right' ? prec.right : prec.left)(precedence, seq(
          field('left', $.expression),
          field('operator', operator),
          field('right', $.expression),
        )),
      ),
    ),

    // DEKA-SPECIFIC: DekaScript unary operators are `!`, `-`, `+` only;
    // `typeof`, `void`, and `delete` are ordinary identifiers.
    unary_expression: $ => prec.left('unary_void', seq(
      field('operator', choice('!', '-', '+')),
      field('argument', $.expression),
    )),
  },
});

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return sepBy1(',', rule);
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {ChoiceRule}
 *
 */
function commaSep(rule) {
  return sepBy(',', rule);
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a separator
 *
 * @param {RuleOrLiteral} sep
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {ChoiceRule}
 */
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}

/**
 * Creates a rule to match one or more of the rules separated by a separator
 *
 * @param {RuleOrLiteral} sep
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 */
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}
