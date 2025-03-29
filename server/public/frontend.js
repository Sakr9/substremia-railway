document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('tmdb-search');
    const clearSearchBtn = document.getElementById('clear-search');
    const searchResultsDiv = document.getElementById('search-results');
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const viewGrid = document.getElementById('view-grid');
    const viewList = document.getElementById('view-list');
    const subtitleListDiv = document.getElementById('subtitle-list');
    const subtitleFileInput = document.getElementById('subtitle-file');
    const customFileButton = document.getElementById('custom-file-button');
    const fileNameDisplay = document.getElementById('file-name-display');
    const filterInput = document.getElementById('filter-subtitles');
    const imdbIdInput = document.getElementById('imdb-id');

    initializeTheme();
    themeToggle.addEventListener('click', toggleTheme);

    setupFileUploadButton();
    setupClearSearchButton();
    setupFilterFunctionality();
    setupSearchResultsPositioning();
    setupDropdownZIndexManagement();

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

        updateThemeToggleButton();
    }

    function toggleTheme() {
        const isDark = html.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';

        if (isDark) {
            html.classList.remove('dark');
        } else {
            html.classList.add('dark');
        }
        localStorage.setItem('theme', newTheme);
        updateThemeToggleButton();
    }

    function updateThemeToggleButton() {
        const isDark = html.classList.contains('dark');
        const themeIcon = themeToggle.querySelector('#theme-icon');

        if (isDark) {
            themeIcon.classList.remove('fa-moon', 'text-gray-600');
            themeIcon.classList.add('fa-sun', 'text-yellow-300');
        } else {
            themeIcon.classList.remove('fa-sun', 'text-yellow-300');
            themeIcon.classList.add('fa-moon', 'text-gray-600');
        }
    }

    function setupFileUploadButton() {
        if (customFileButton && subtitleFileInput && fileNameDisplay) {
            customFileButton.addEventListener('click', () => {
                subtitleFileInput.click();
            });

            subtitleFileInput.addEventListener('change', () => {
                if (subtitleFileInput.files.length > 0) {
                    fileNameDisplay.innerHTML = `<i class="fas fa-check-circle text-green-500 mr-2"></i> ${subtitleFileInput.files[0].name}`;
                } else {
                    fileNameDisplay.innerHTML = `<i class="fas fa-info-circle mr-2"></i> Nessun file selezionato`;
                }
            });
        }
    }

    function setupClearSearchButton() {
        searchInput.addEventListener('input', function() {
            if (this.value) {
                clearSearchBtn.style.opacity = '1';
            } else {
                clearSearchBtn.style.opacity = '0';
                searchResultsDiv.classList.add('hidden');
            }
        });

        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            this.style.opacity = '0';
            searchResultsDiv.classList.add('hidden');
            resetZIndexes();
        });

        document.addEventListener('click', (event) => {
            if (!searchResultsDiv.contains(event.target) && event.target !== searchInput) {
                searchResultsDiv.classList.add('hidden');
                resetZIndexes();
            }
        });
    }

    function setupFilterFunctionality() {
        const clearFilterBtn = document.getElementById('clear-filter');
        const filterStatsDiv = document.getElementById('filter-stats');
        const resultsCountSpan = document.getElementById('results-count');
        const searchTermSpan = document.getElementById('search-term');
        const resetFilterBtn = document.getElementById('reset-filter');
        const noResultsDiv = document.getElementById('no-results');

        filterInput.addEventListener('input', function() {
            const filter = this.value.toLowerCase().trim();

            if (filter) {
                clearFilterBtn.style.opacity = '1';
            } else {
                clearFilterBtn.style.opacity = '0';
            }

            filterSubtitles(filter);
        });

        clearFilterBtn.addEventListener('click', function() {
            filterInput.value = '';
            clearFilterBtn.style.opacity = '0';
            filterSubtitles('');
        });
        resetFilterBtn.addEventListener('click', function() {
            filterInput.value = '';
            clearFilterBtn.style.opacity = '0';
            filterSubtitles('');
        });

        function filterSubtitles(filter) {
            const items = document.querySelectorAll('#subtitle-list > div.subtitle-item');
            let visibleCount = 0;

            if (filter === '') {
                items.forEach(item => {
                    item.classList.remove('hidden');
                });

                filterStatsDiv.classList.add('hidden');
                noResultsDiv.classList.add('hidden');
                return;
            }
            items.forEach(item => {
                const title = item.dataset.title?.toLowerCase() || '';
                const id = item.dataset.id?.toLowerCase() || '';
                const type = item.dataset.type?.toLowerCase() || '';
                const contentText = item.textContent.toLowerCase();

                const shouldShow = title.includes(filter) ||
                                  id.includes(filter) ||
                                  type.includes(filter) ||
                                  contentText.includes(filter);

                if (shouldShow) {
                    item.classList.remove('hidden');
                    visibleCount++;
                } else {
                    item.classList.add('hidden');
                }
            });

            resultsCountSpan.textContent = visibleCount;
            searchTermSpan.textContent = filter;

            if (visibleCount > 0) {
                filterStatsDiv.classList.remove('hidden');
                noResultsDiv.classList.add('hidden');
            } else {
                filterStatsDiv.classList.add('hidden');
                noResultsDiv.classList.remove('hidden');
            }
        }
    }

    function setupSearchResultsPositioning() {
        window.addEventListener('resize', positionSearchResults);
        window.addEventListener('scroll', positionSearchResults);
    }

    function setupDropdownZIndexManagement() {
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 3) {
                elevateSearchDropdown();
            }
        });

        window.uiHelpers = {
            positionSearchResults: positionSearchResults,
            resetZIndexes: resetZIndexes
        };
    }

    function positionSearchResults() {
        if (!searchResultsDiv.classList.contains('hidden')) {
            elevateSearchDropdown();
        }
    }

    function elevateSearchDropdown() {
        resetZIndexes();

        const searchContainer = searchInput.closest('.relative');
        const searchSection = document.getElementById('search-section');

        if (searchContainer && searchSection) {
            searchSection.style.position = 'relative';
            searchSection.style.zIndex = '999';
            searchContainer.style.position = 'relative';
            searchContainer.style.zIndex = '999';

            const navbar = document.querySelector('nav');
            if (navbar) {
                navbar.style.zIndex = '1000';
            }
        }

        searchResultsDiv.style.position = 'absolute';
        searchResultsDiv.style.zIndex = '998';
        searchResultsDiv.style.top = '100%';
        searchResultsDiv.style.left = '0';
        searchResultsDiv.style.right = '0';
        searchResultsDiv.style.width = '100%';

        searchResultsDiv.style.transform = 'none';

        document.querySelectorAll('.container > *:not(#search-section)').forEach(el => {
            if (el.style) {
                el.style.position = 'relative';
                el.style.zIndex = '1';
            }
        });
    }

    function resetZIndexes() {
        document.body.classList.remove('imdb-dropdown-open');

        const searchContainer = searchInput.closest('.relative');
        const searchSection = document.getElementById('search-section');

        if (searchContainer) searchContainer.style.zIndex = '';
        if (searchSection) searchSection.style.zIndex = '';

        const imdbContainer = imdbIdInput?.closest('.group');
        if (imdbContainer) imdbContainer.style.zIndex = '';

        const navbar = document.querySelector('nav');
        if (navbar) navbar.style.zIndex = '50';

        document.querySelectorAll('hr').forEach(hr => {
            hr.style.zIndex = '';
            hr.style.position = '';
        });
        document.querySelectorAll('.container > *').forEach(el => {
            if (el.style) el.style.zIndex = '';
        });
    }

    const originalClassListRemove = searchResultsDiv.classList.remove;
    searchResultsDiv.classList.remove = function(className) {
        originalClassListRemove.call(this, className);
        if (className === 'hidden') {
            setTimeout(positionSearchResults, 10);
        }
        return this;
    };

    window.showNotification = function(message, type = 'success') {
        const toast = document.getElementById('notification-toast');
        const toastMessage = document.getElementById('toast-message');
        const toastIcon = document.getElementById('toast-icon');

        toastMessage.textContent = message;

        if (type === 'success') {
            toastIcon.innerHTML = '<i class="fas fa-check-circle text-xl"></i>';
            toastIcon.className = 'flex-shrink-0 mr-3 text-green-500';
        } else if (type === 'error') {
            toastIcon.innerHTML = '<i class="fas fa-times-circle text-xl"></i>';
            toastIcon.className = 'flex-shrink-0 mr-3 text-red-500';
        } else if (type === 'warning') {
            toastIcon.innerHTML = '<i class="fas fa-exclamation-circle text-xl"></i>';
            toastIcon.className = 'flex-shrink-0 mr-3 text-yellow-500';
        }

        toast.classList.remove('translate-y-full', 'opacity-0');

        setTimeout(() => {
            toast.classList.add('translate-y-full', 'opacity-0');
        }, 3000);
    };

    document.getElementById('close-toast').addEventListener('click', function() {
        document.getElementById('notification-toast').classList.add('translate-y-full', 'opacity-0');
    });
});
