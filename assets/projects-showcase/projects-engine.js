(function () {
  "use strict";

  const DEFAULT_DATA_URL = "https://evrin5203-web.github.io/scd-bpla-assets/assets/projects-showcase/projects.json?v=1";
  const OPTIONS = window.LPI_PROJECTS_OPTIONS_V4 || {};

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function normalizeProjects(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.projects)) return data.projects;
    return [];
  }

  function loadProjects() {
    if (Array.isArray(window.LPI_PROJECTS_DATA)) {
      return Promise.resolve(window.LPI_PROJECTS_DATA);
    }
    const dataUrl = OPTIONS.dataUrl || DEFAULT_DATA_URL;
    return fetch(dataUrl)
      .then(function (response) {
        if (!response.ok) throw new Error("Projects JSON load failed: " + response.status);
        return response.json();
      })
      .then(normalizeProjects);
  }

  function initProjectsShowcase(projects) {
  const section = document.querySelector(".lpi-projects-showcase-v4");
    if (!section || section.dataset.lpiReady === "true") return;
    section.dataset.lpiReady = "true";
    const PROJECTS = Array.isArray(projects) ? projects : [];
    const rail = section.querySelector("#lpiProjectsRailV4");
    const filters = Array.from(section.querySelectorAll(".lpi-projects-filter[data-filter]"));
    const progressBar = section.querySelector(".lpi-projects-progress span");
    const modal = section.querySelector("#lpiProjectModalV4");
    const modalInfo = modal.querySelector(".lpi-project-modal-info");
    const modalClose = modal.querySelector(".lpi-project-modal-close");
    const modalAwards = modal.querySelector(".lpi-project-modal-awards");
    const modalLabel = modal.querySelector(".lpi-project-modal-label");
    const modalTitle = modal.querySelector(".lpi-project-modal-title");
    const modalDescription = modal.querySelector(".lpi-project-modal-description");
    const modalLink = modal.querySelector(".lpi-project-modal-link");
    const modalStage = modal.querySelector(".lpi-project-modal-stage");
    const modalThumbs = modal.querySelector(".lpi-project-modal-thumbs");
    const modalCount = modal.querySelector(".lpi-project-modal-count");
    const modalPrev = modal.querySelector(".lpi-project-modal-prev");
    const modalNext = modal.querySelector(".lpi-project-modal-next");
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    let currentFilter = "all";
    let currentImages = [];
    let currentIndex = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeftStart = 0;
    let moved = false;
    let pressedCardId = null;
    function escapeHTML(str) {
      return (str || "").replace(/[&<>"']/g, function (m) {
        return ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[m];
      });
    }
    function pad(num) {
      return String(num).padStart(2, "0");
    }
    function getProjectById(id) {
      return PROJECTS.find(function (project) {
        return project.id === id;
      });
    }
    function uniqueImages(images) {
      const result = [];
      const seen = new Set();
      (images || []).forEach(function (src) {
        if (!src || seen.has(src)) return;
        seen.add(src);
        result.push(src);
      });
      return result;
    }
    function formatDescription(description) {
      const html = (description || "").trim();
      if (!html) return "";
      if (/<p[\s>]|<br\s*\/?>|<h[1-6][\s>]/i.test(html)) return html;
      const parts = html
        .replace(/\.\s+/g, ".||")
        .split("||")
        .map(function (part) { return part.trim(); })
        .filter(Boolean);
      if (parts.length <= 1) {
        return "<p>" + html + "</p>";
      }
      const paragraphs = [];
      for (let i = 0; i < parts.length; i += 2) {
        paragraphs.push("<p>" + parts.slice(i, i + 2).join(" ") + "</p>");
      }
      return paragraphs.join("");
    }
    function createCard(project, index) {
      const article = document.createElement("article");
      article.className = "lpi-project-card";
      article.dataset.projectId = project.id;
      article.dataset.categories = project.categories.join(" ");
      article.style.setProperty("--delay", (index * 56 + 260) + "ms");
      article.innerHTML = `
        <button class="lpi-project-card__button" type="button" aria-label="Открыть проект ${escapeHTML(project.title)}">
          <img
            class="lpi-project-card__image"
            src="${project.cover}"
            alt="${escapeHTML(project.title)}"
            loading="${index < 6 ? "eager" : "lazy"}"
            decoding="async"
            fetchpriority="${index < 3 ? "high" : "low"}"
          >
          <div class="lpi-project-card__overlay"></div>
          <div class="lpi-project-card__caption">
            <h3 class="lpi-project-card__title">${escapeHTML(project.title)}</h3>
          </div>
        </button>
      `;
      return article;
    }
    function renderCards() {
      rail.innerHTML = "";
      PROJECTS.forEach(function (project, index) {
        rail.appendChild(createCard(project, index));
      });
      applyFilter(currentFilter, false);
    }
    function getVisibleCards() {
      return Array.from(rail.querySelectorAll(".lpi-project-card")).filter(function (card) {
        return !card.classList.contains("is-filtered-out");
      });
    }
    function getTargetRowsCount() {
      return window.matchMedia("(max-width: 960px)").matches ? 2 : 3;
    }
    function getActiveRowsCount(visibleCount) {
      const targetRows = getTargetRowsCount();
      return visibleCount <= targetRows ? 1 : targetRows;
    }
    function updateCardDelays() {
      getVisibleCards().forEach(function (card, index) {
        card.style.setProperty("--delay", (index * 56 + 260) + "ms");
        card.style.setProperty("--row-shift-x", "0px");
      });
    }
    function updateRowsAndScrollState() {
      const visibleCount = getVisibleCards().length;
      const activeRows = getActiveRowsCount(visibleCount);
      section.classList.toggle("is-one-row", activeRows === 1);
      section.classList.toggle("is-two-rows", activeRows === 2);
      section.classList.toggle("is-three-rows", activeRows === 3);
      updateCardDelays();
      requestAnimationFrame(function () {
        const max = rail.scrollWidth - rail.clientWidth;
        section.classList.toggle("is-no-scroll", max <= 2);
        updateProgress();
      });
    }
    function updateProgress() {
      const max = rail.scrollWidth - rail.clientWidth;
      const ratio = max <= 0 ? 0 : rail.scrollLeft / max;
      const scale = max <= 2 ? 1 : Math.max(.14, .14 + ratio * .86);
      if (progressBar) {
        progressBar.style.transform = "scaleX(" + scale.toFixed(4) + ")";
      }
    }
    function applyFilter(filter, withScrollReset = true) {
      currentFilter = filter;
      filters.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.filter === filter);
      });
      Array.from(rail.querySelectorAll(".lpi-project-card")).forEach(function (card) {
        const categories = (card.dataset.categories || "").split(" ");
        const visible = filter === "all" || categories.includes(filter);
        card.classList.toggle("is-filtered-out", !visible);
      });
      updateCardDelays();
      updateRowsAndScrollState();
      if (withScrollReset) {
        rail.scrollTo({ left: 0, behavior: "smooth" });
        setTimeout(updateProgress, 150);
      }
    }
    function updateInfoAlignment(project) {
      const hasAwards = !!(project.awards && project.awards.length);
      modal.classList.toggle("has-awards", hasAwards);
      modal.classList.remove("is-info-bottom");
      if (hasAwards || !modalInfo) return;
      requestAnimationFrame(function () {
        if (!modal.classList.contains("is-open")) return;
        const contentFits = modalInfo.scrollHeight <= modalInfo.clientHeight + 6;
        modal.classList.toggle("is-info-bottom", contentFits);
      });
    }
    function renderAwards(project) {
      if (!modalAwards) return;
      modalAwards.innerHTML = "";
      const awards = project.awards || [];
      modalAwards.classList.remove("is-awards-row", "is-awards-one");
      modalAwards.style.removeProperty("--awards-count");
      if (!awards.length) {
        modalAwards.classList.add("is-hidden");
        return;
      }
      modalAwards.classList.remove("is-hidden");
      modalAwards.classList.toggle("is-awards-row", awards.length >= 2 && awards.length <= 3);
      modalAwards.classList.toggle("is-awards-one", awards.length === 1);
      modalAwards.style.setProperty("--awards-count", String(Math.max(1, Math.min(3, awards.length))));
      awards.forEach(function (award) {
        const link = document.createElement("a");
        link.className = "lpi-project-award";
        link.href = award.url || "#";
        link.target = "_blank";
        link.rel = "noopener";
        link.title = [award.title, award.result || award.caption].filter(Boolean).join(" — ");
        link.setAttribute("aria-label", link.title);
        const logo = document.createElement("span");
        logo.className = "lpi-project-award__logo";
        if (award.logoBg === "dark") {
          logo.classList.add("is-dark");
        }
        if (award.logoWide) {
          logo.classList.add("is-wide");
        }
        if (award.img) {
          const img = document.createElement("img");
          img.src = award.img;
          img.alt = award.title;
          img.loading = "lazy";
          img.decoding = "async";
          logo.appendChild(img);
        } else {
          const fallback = document.createElement("span");
          fallback.className = "lpi-project-award__fallback";
          fallback.textContent = (award.short || award.title || "AWARD")
            .replace(/International Architecture & Design Awards/i, "IADA")
            .replace(/MUSE Design Awards/i, "MUSE")
            .replace(/European Product Design Award/i, "EPDA")
            .replace(/International Design Awards/i, "IDA");
          logo.appendChild(fallback);
        }
        const content = document.createElement("span");
        content.className = "lpi-project-award__content";
        const title = document.createElement("span");
        title.className = "lpi-project-award__title";
        title.textContent = award.title || "Award";
        content.appendChild(title);
        const result = document.createElement("span");
        result.className = "lpi-project-award__result";
        result.textContent = award.result || award.caption || "Winner";
        content.appendChild(result);
        link.appendChild(logo);
        link.appendChild(content);
        modalAwards.appendChild(link);
      });
    }
    function applyAdaptiveStageFit(img) {
      function updateFit() {
        const width = img.naturalWidth || 0;
        const height = img.naturalHeight || 0;
        if (!width || !height) return;
        const ratio = width / height;
        const shouldContain = ratio <= 1.22;
        img.classList.toggle("is-lpi-contain-image", shouldContain);
      }
      img.addEventListener("load", updateFit);
      if (img.complete) {
        requestAnimationFrame(updateFit);
      }
    }
    function setStageImage(src, alt, fallback) {
      modalStage.innerHTML = "";
      const img = document.createElement("img");
      img.src = src;
      img.alt = alt || "";
      img.onerror = function () {
        if (fallback && img.src !== fallback) {
          img.classList.remove("is-lpi-contain-image");
          img.src = fallback;
        }
      };
      applyAdaptiveStageFit(img);
      modalStage.appendChild(img);
    }
    function renderThumbs(images, fallback) {
      modalThumbs.innerHTML = "";
      images.forEach(function (src, index) {
        const button = document.createElement("button");
        button.className = "lpi-project-modal-thumb";
        button.type = "button";
        if (index === currentIndex) {
          button.classList.add("is-active");
        }
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.onerror = function () {
          if (fallback && img.src !== fallback) img.src = fallback;
        };
        button.appendChild(img);
        button.addEventListener("click", function (event) {
          event.preventDefault();
          currentIndex = index;
          updateModalMedia();
        });
        modalThumbs.appendChild(button);
      });
    }
    function updateModalMedia() {
      const project = getProjectById(modal.dataset.projectId);
      if (!project || !currentImages.length) return;
      currentIndex = ((currentIndex % currentImages.length) + currentImages.length) % currentImages.length;
      setStageImage(currentImages[currentIndex], project.title, project.cover);
      modalCount.textContent = pad(currentIndex + 1) + " / " + pad(currentImages.length);
      Array.from(modalThumbs.children).forEach(function (thumb, index) {
        thumb.classList.toggle("is-active", index === currentIndex);
      });
    }
    function openModal(projectId) {
      const project = getProjectById(projectId);
      if (!project) return;
      modal.dataset.projectId = project.id;
      modal.classList.remove("has-awards", "is-info-bottom");
      modal.classList.toggle("has-awards", !!(project.awards && project.awards.length));
      modalLabel.textContent = project.label;
      modalTitle.textContent = project.title;
      modalDescription.innerHTML = formatDescription(project.description);
      renderAwards(project);
      if (project.behance) {
        modalLink.href = project.behance;
        modalLink.classList.remove("is-hidden");
      } else {
        modalLink.href = "#";
        modalLink.classList.add("is-hidden");
      }
      currentImages = uniqueImages(project.images && project.images.length ? project.images : [project.cover]);
      currentIndex = 0;
      modal.classList.toggle("is-single", currentImages.length <= 1);
      renderThumbs(currentImages, project.cover);
      updateModalMedia();
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      updateInfoAlignment(project);
      document.documentElement.classList.add("lpi-projects-modal-lock");
      document.body.classList.add("lpi-projects-modal-lock");
    }
    function closeModal() {
      modal.classList.remove("is-open", "has-awards", "is-info-bottom");
      modal.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("lpi-projects-modal-lock");
      document.body.classList.remove("lpi-projects-modal-lock");
      setTimeout(function () {
        if (!modal.classList.contains("is-open")) {
          modalStage.innerHTML = "";
          modalThumbs.innerHTML = "";
          if (modalAwards) {
            modalAwards.innerHTML = "";
            modalAwards.classList.add("is-hidden");
          }
          modal.dataset.projectId = "";
        }
      }, 220);
    }
    window.LPIProjectsV4 = {
      open: openModal,
      close: closeModal,
      getProject: getProjectById
    };
    window.dispatchEvent(new CustomEvent("lpiProjectsReadyV4"));
    renderCards();
    filters.forEach(function (button) {
      button.addEventListener("click", function () {
        applyFilter(button.dataset.filter, true);
      });
    });
    rail.addEventListener("scroll", updateProgress, { passive: true });
    rail.addEventListener("pointerdown", function (event) {
      const card = event.target.closest(".lpi-project-card");
      isDragging = true;
      moved = false;
      pressedCardId = card ? card.dataset.projectId : null;
      startX = event.clientX;
      startY = event.clientY;
      scrollLeftStart = rail.scrollLeft;
      rail.classList.add("is-dragging");
    });
    rail.addEventListener("pointermove", function (event) {
      if (!isDragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7) moved = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        rail.scrollLeft = scrollLeftStart - dx;
      }
    });
    function finishPointer(event) {
      if (!isDragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const isTap = Math.abs(dx) < 8 && Math.abs(dy) < 8;
      rail.classList.remove("is-dragging");
      isDragging = false;
      if (pressedCardId && isTap && !moved) {
        openModal(pressedCardId);
      }
      pressedCardId = null;
      setTimeout(function () {
        moved = false;
      }, 80);
    }
    rail.addEventListener("pointerup", finishPointer);
    rail.addEventListener("pointercancel", function () {
      isDragging = false;
      moved = false;
      pressedCardId = null;
      rail.classList.remove("is-dragging");
    });
    rail.addEventListener("mouseleave", function () {
      isDragging = false;
      moved = false;
      pressedCardId = null;
      rail.classList.remove("is-dragging");
    });
    rail.addEventListener("click", function (event) {
      const card = event.target.closest(".lpi-project-card");
      if (!card || moved) return;
      event.preventDefault();
      openModal(card.dataset.projectId);
    });
    modalClose.addEventListener("click", function (event) {
      event.preventDefault();
      closeModal();
    });
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
    modalPrev.addEventListener("click", function (event) {
      event.preventDefault();
      currentIndex -= 1;
      updateModalMedia();
    });
    modalNext.addEventListener("click", function (event) {
      event.preventDefault();
      currentIndex += 1;
      updateModalMedia();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
      if (modal.classList.contains("is-open") && event.key === "ArrowLeft") {
        currentIndex -= 1;
        updateModalMedia();
      }
      if (modal.classList.contains("is-open") && event.key === "ArrowRight") {
        currentIndex += 1;
        updateModalMedia();
      }
    });
    updateRowsAndScrollState();
    updateProgress();
    function showSection() {
      section.classList.add("is-visible");
    }
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            showSection();
            observer.disconnect();
          }
        });
      }, {
        threshold: 0.22,
        rootMargin: "0px 0px -12% 0px"
      });
      observer.observe(section);
    } else {
      showSection();
    }
    window.addEventListener("resize", function () {
      updateRowsAndScrollState();
      updateProgress();
    });
  }

  onReady(function () {
    loadProjects()
      .then(initProjectsShowcase)
      .catch(function (error) {
        console.error("LPI projects: не удалось загрузить projects.json", error);
        initProjectsShowcase([]);
      });
  });
})();
