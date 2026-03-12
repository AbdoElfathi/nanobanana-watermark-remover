/**
 * @file    render_backend.cpp
 * @brief   Render Backend Factory Implementation
 * @author  AllenK (Kwyshell)
 * @license MIT
 */

#include "gui/backend/render_backend.hpp"
#include "gui/backend/opengl_backend.hpp"

#if defined(_WIN32)
#include "gui/backend/d3d11_backend.hpp"
#endif

#if defined(GWT_HAS_VULKAN)
#include "gui/backend/vulkan_backend.hpp"
#endif

#include <spdlog/spdlog.h>

namespace gwt::gui {

std::unique_ptr<IRenderBackend> create_backend(BackendType type) {
    // Auto mode: try backends in order of preference (platform-specific)
    if (type == BackendType::Auto) {
#if defined(_WIN32)
        // Windows: prefer D3D11 for better VM/RDP compatibility
        if (is_backend_available(BackendType::D3D11)) {
            spdlog::info("Auto-selecting D3D11 backend");
            return std::make_unique<D3D11Backend>();
        }
        spdlog::debug("D3D11 not available, trying OpenGL");
#endif

#if defined(GWT_HAS_VULKAN)
        // Try Vulkan if enabled
        if (is_backend_available(BackendType::Vulkan)) {
            spdlog::info("Auto-selecting Vulkan backend");
            return std::make_unique<VulkanBackend>();
        }
        spdlog::debug("Vulkan not available, trying OpenGL");
#endif
        // Fall back to OpenGL
        type = BackendType::OpenGL;
    }

    // Create specific backend
    switch (type) {
        case BackendType::OpenGL:
            spdlog::info("Creating OpenGL backend");
            return std::make_unique<OpenGLBackend>();

#if defined(_WIN32)
        case BackendType::D3D11:
            spdlog::info("Creating D3D11 backend");
            return std::make_unique<D3D11Backend>();
#endif

#if defined(GWT_HAS_VULKAN)
        case BackendType::Vulkan:
            spdlog::info("Creating Vulkan backend");
            return std::make_unique<VulkanBackend>();
#endif

        default:
            spdlog::error("Unknown backend type requested");
            return nullptr;
    }
}

bool is_backend_available(BackendType type) noexcept {
    switch (type) {
        case BackendType::OpenGL:
            // OpenGL is always available (compiled in)
            return true;

#if defined(_WIN32)
        case BackendType::D3D11:
            // Check if D3D11 runtime is available
            return D3D11Backend::is_available();
#endif

#if defined(GWT_HAS_VULKAN)
        case BackendType::Vulkan:
            // Check if Vulkan runtime is available
            return VulkanBackend::is_available();
#endif

        case BackendType::Auto:
            // Auto is always "available" (will fall back)
            return true;

        default:
            return false;
    }
}

}  // namespace gwt::gui
