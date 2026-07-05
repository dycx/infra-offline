// ============================================================
// C++ 后端模板 — 从 Qt main 改造为独立 HTTP 服务
// 编译器: MinGW | 依赖: cpp-httplib + nlohmann/json
// ============================================================

#include <httplib.h>          // https://github.com/yhirose/cpp-httplib (单头文件)
#include <nlohmann/json.hpp>  // https://github.com/nlohmann/json  (单头文件)
#include <iostream>
#include <string>
#include <vector>

using json = nlohmann::json;

// ═══════════════════════════════════════════════════════
//  你的原有业务逻辑 — 直接搬过来
// ═══════════════════════════════════════════════════════

struct DataItem {
    int id;
    std::string name;
    std::string status;
    std::string time;
};

// 模拟数据库操作 — 替换为你的实际代码
std::vector<DataItem> queryData(int page, const std::string& search) {
    // 原有 QSqlQuery 代码放这里
    std::vector<DataItem> result;
    // ... SELECT * FROM table WHERE name LIKE ...
    return result;
}

json getStats() {
    // 原有统计逻辑
    return {{"total", 100}, {"active", 45}, {"pending", 12}};
}

// ═══════════════════════════════════════════════════════
//  HTTP Server + API 路由 — 新增部分
// ═══════════════════════════════════════════════════════

int main(int argc, char** argv) {
    int port = 3456;

    // 命令行参数解析
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) port = std::stoi(argv[++i]);
    }

    httplib::Server svr;

    // ── 健康检查 ─────────────────────────────────
    svr.Get("/health", [](auto&, auto& res) {
        res.set_content("ok", "text/plain");
    });

    // ── 优雅关闭 ─────────────────────────────────
    svr.Post("/shutdown", [&svr](auto&, auto& res) {
        res.set_content("bye", "text/plain");
        svr.stop();
    });

    // ── 统计 ─────────────────────────────────────
    svr.Get("/api/stats", [](auto&, auto& res) {
        json stats = getStats();
        res.set_content(stats.dump(), "application/json");
    });

    // ── 数据列表 (分页 + 搜索) ───────────────────
    svr.Get("/api/data", [](auto& req, auto& res) {
        int page = 1;
        std::string search;

        if (req.has_param("page")) page = std::stoi(req.get_param_value("page"));
        if (req.has_param("search")) search = req.get_param_value("search");

        auto items = queryData(page, search);
        json result;
        result["items"] = json::array();
        for (auto& item : items) {
            result["items"].push_back({
                {"id", item.id},
                {"name", item.name},
                {"status", item.status},
                {"time", item.time}
            });
        }
        result["page"] = page;
        result["totalPages"] = 10;

        res.set_content(result.dump(), "application/json");
    });

    // ── 单条查询 ─────────────────────────────────
    svr.Get("/api/data/(\\d+)", [](auto& req, auto& res) {
        int id = std::stoi(req.matches[1]);
        // 原有查询逻辑
        json item = {{"id", id}, {"name", "示例"}, {"status", "active"}};
        res.set_content(item.dump(), "application/json");
    });

    // ── 新增 ─────────────────────────────────────
    svr.Post("/api/data", [](auto& req, auto& res) {
        auto body = json::parse(req.body);
        std::string name = body["name"];
        // 原有插入逻辑
        json result = {{"ok", true}, {"id", 123}};
        res.set_content(result.dump(), "application/json");
    });

    // ── 修改 ─────────────────────────────────────
    svr.Put("/api/data/(\\d+)", [](auto& req, auto& res) {
        int id = std::stoi(req.matches[1]);
        auto body = json::parse(req.body);
        // 原有更新逻辑
        json result = {{"ok", true}};
        res.set_content(result.dump(), "application/json");
    });

    // ── 删除 ─────────────────────────────────────
    svr.Delete("/api/data/(\\d+)", [](auto& req, auto& res) {
        int id = std::stoi(req.matches[1]);
        // 原有删除逻辑
        json result = {{"ok", true}};
        res.set_content(result.dump(), "application/json");
    });

    std::cout << "Backend listening on http://localhost:" << port << std::endl;
    svr.listen("127.0.0.1", port);
    return 0;
}

// ═══════════════════════════════════════════════════════
//  CMakeLists.txt
// ═══════════════════════════════════════════════════════
//
//  cmake_minimum_required(VERSION 3.14)
//  project(backend)
//  set(CMAKE_CXX_STANDARD 17)
//
//  # cpp-httplib 和 nlohmann/json 都是 header-only
//  # 下载后放 include/ 目录即可，不需要编译
//  include_directories(include)
//
//  add_executable(backend main.cpp)
//  target_link_libraries(backend ws2_32)   # Windows socket
