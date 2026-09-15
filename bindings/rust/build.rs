fn main() {
    let root_dir = std::path::Path::new(".");
    let src_dir = root_dir.join("src");
    let scanner_dir = root_dir.join("scanner");

    let mut config = cc::Build::new();
    config.include(&src_dir);
    config
        .flag_if_supported("-std=c11")
        .flag_if_supported("-Wno-unused-parameter");

    let parser_path = src_dir.join("parser.c");
    let scanner_path = src_dir.join("scanner.c");
    config.file(&parser_path);
    config.file(&scanner_path);
    println!("cargo:rerun-if-changed={}", parser_path.to_str().unwrap());
    println!("cargo:rerun-if-changed={}", scanner_path.to_str().unwrap());
    println!(
        "cargo:rerun-if-changed={}",
        scanner_dir.join("scanner.h").to_str().unwrap()
    );

    config.compile("tree-sitter-deka");
}
