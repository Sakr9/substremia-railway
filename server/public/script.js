document.addEventListener('DOMContentLoaded', () => {
    const contentTypeSelect = document.getElementById('content-type');
    const seriesFields = document.getElementById('series-fields');
    const imdbIdInput = document.getElementById('imdb-id');
    const seasonInput = document.getElementById('season');
    const episodeInput = document.getElementById('episode');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatusDiv = document.getElementById('upload-status');
    const subtitleListDiv = document.getElementById('subtitle-list');
    const loadingMessage = document.getElementById('loading-message');
    const seriesDatalist = document.getElementById('series-imdb-list');
    const searchInput = document.getElementById('tmdb-search');
    const searchResultsDiv = document.getElementById('search-results');
    const manifestLinkInput = document.getElementById('manifest-link');
    const copyLinkButton = document.getElementById('copy-link-button');
    const copyStatusP = document.getElementById('copy-status');

    let seriesDataCache = [];
    let searchTimeout;
    let copyTimeout;

    if (manifestLinkInput && copyLinkButton && copyStatusP) {
        const manifestUrl = `${window.location.origin}/addon/manifest.json`;
        manifestLinkInput.value = manifestUrl;

        copyLinkButton.addEventListener('click', () => {
            navigator.clipboard.writeText(manifestUrl).then(() => {
                copyStatusP.textContent = 'Copied!';
                copyLinkButton.innerHTML = '<i class="fas fa-check"></i>';

                clearTimeout(copyTimeout);
                copyTimeout = setTimeout(() => {
                    copyStatusP.textContent = '';
                    copyLinkButton.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy manifest link: ', err);
                copyStatusP.textContent = 'Copy failed!';
                copyStatusP.classList.remove('text-green-600', 'dark:text-green-400');
                copyStatusP.classList.add('text-red-600', 'dark:text-red-400');

                clearTimeout(copyTimeout);
                copyTimeout = setTimeout(() => {
                    copyStatusP.textContent = '';
                    copyStatusP.classList.remove('text-red-600', 'dark:text-red-400');
                    copyStatusP.classList.add('text-green-600', 'dark:text-green-400');
                }, 2000);
            });
        });
    }

    function toggleSeriesFields() {
        const isSeries = contentTypeSelect.value === 'series';
        seriesFields.style.display = isSeries ? 'grid' : 'none';
        seasonInput.required = isSeries;
        episodeInput.required = isSeries;
        if (isSeries) {
            imdbIdInput.placeholder = 'e.g., tt3107288 (Series ID only)';
            imdbIdInput.pattern = '^tt\\d+$';
        } else {
            imdbIdInput.placeholder = 'e.g., tt1254207';
            imdbIdInput.pattern = '^tt\\d+$';
        }
        seasonInput.value = '';
        episodeInput.value = '';
        if (isSeries && imdbIdInput.value) {
            handleImdbIdChange();
        }
    }

    contentTypeSelect.addEventListener('change', toggleSeriesFields);
    imdbIdInput.addEventListener('change', handleImdbIdChange);
    searchInput.addEventListener('input', handleSearchInput);
    toggleSeriesFields();

    async function fetchSubtitles() {
        loadingMessage.style.display = 'block';
        subtitleListDiv.innerHTML = '';
        subtitleListDiv.appendChild(loadingMessage);

        try {
            const response = await fetch('/api/listall');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            renderSubtitleList(data);

        } catch (error) {
            loadingMessage.textContent = 'Failed to load subtitles.';
            loadingMessage.className = 'text-center text-red-600 font-semibold';
        }
    }

    function renderSubtitleList(data) {
        const subtitleSkeletonDiv = document.getElementById('subtitle-skeleton');
        const loadingMessage = document.getElementById('loading-message');
        const subtitleListDiv = document.getElementById('subtitle-list');
        const emptyStateDiv = document.getElementById('empty-state');

        subtitleSkeletonDiv.classList.add('hidden');
        loadingMessage.style.display = 'none';
        subtitleListDiv.innerHTML = '';

        if (!data || (!data.movies?.length && !data.series?.length)) {
            emptyStateDiv.classList.remove('hidden');
            subtitleListDiv.classList.add('hidden');
            return;
        }

        emptyStateDiv.classList.add('hidden');
        subtitleListDiv.classList.remove('hidden');

        window.moviesCache = data.movies || [];
        seriesDataCache = data.series || [];

        let hasMovies = false;
        let hasSeries = false;

        if (data.movies && data.movies.length > 0) {
            hasMovies = true;
            const moviesSection = document.createElement('div');
            moviesSection.className = 'mb-12';

            const moviesSectionTitle = document.createElement('h3');
            moviesSectionTitle.className = 'text-xl font-bold mb-6 text-gray-800 dark:text-gray-200 flex items-center';
            moviesSectionTitle.innerHTML = '<i class="fas fa-film mr-2 text-indigo-600 dark:text-indigo-400"></i> Film';
            moviesSection.appendChild(moviesSectionTitle);

            const moviesGrid = document.createElement('div');
            moviesGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

            const sortedMovies = [...data.movies].sort((a, b) => a.title.localeCompare(b.title));

            sortedMovies.forEach(movie => {
                const movieDiv = document.createElement('div');
                movieDiv.className = 'subtitle-item flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800 group';
                movieDiv.dataset.title = movie.title;
                movieDiv.dataset.id = movie.imdbId;
                movieDiv.dataset.type = 'movie';
                const posterHtml = movie.posterPath
                    ? `<img src="${movie.posterPath}" alt="${movie.title}" class="poster-image w-full h-48 object-contain group-hover:opacity-90 transition-opacity">`
                    : `<div class="poster-image w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                         <span class="text-gray-400 dark:text-gray-500 text-lg"><i class="fas fa-film mr-2"></i>No Poster</span>
                       </div>`;

                movieDiv.innerHTML = `
                    <div class="poster-container relative">
                        ${posterHtml}
                    </div>
                    <div class="flex-1 p-4">
                        <div class="flex justify-between items-start mb-1">
                            <h5 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white line-clamp-1">${movie.title}</h5>
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">${movie.imdbId}</span>
                        </div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                <i class="fas fa-film mr-1"></i> Film
                            </span>
                        </div>
                        <div class="language-list space-y-2 mt-3">
                            ${movie.languages.map(lang => `
                                <div class="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                    <span class="badge bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">${lang}</span>
                                    <button
                                        data-type="movie"
                                        data-imdbid="${movie.imdbId}"
                                        data-lang="${lang}"
                                        class="delete-btn bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-800/60 focus:ring-2 focus:outline-none focus:ring-red-300 dark:focus:ring-red-700 font-medium rounded-lg text-xs px-3 py-1.5 text-center transition-all duration-300 flex items-center justify-center gap-1 border border-red-200 dark:border-red-800/70 shadow-sm">
                                        <i class="fas fa-trash-alt text-red-600 dark:text-red-400"></i>
                                        <span>Elimina</span>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                moviesGrid.appendChild(movieDiv);
            });

            moviesSection.appendChild(moviesGrid);
            subtitleListDiv.appendChild(moviesSection);
        }

        if (hasMovies && data.series && data.series.length > 0) {
            const separator = document.createElement('hr');
            separator.className = 'border-t border-gray-300 dark:border-gray-600 my-12';
            subtitleListDiv.appendChild(separator);
        }

        if (data.series && data.series.length > 0) {
            hasSeries = true;
            const seriesSection = document.createElement('div');
            seriesSection.className = hasMovies ? 'mt-12' : '';

            const seriesSectionTitle = document.createElement('h3');
            seriesSectionTitle.className = 'text-xl font-bold mb-6 text-gray-800 dark:text-gray-200 flex items-center';
            seriesSectionTitle.innerHTML = '<i class="fas fa-tv mr-2 text-purple-600 dark:text-purple-400"></i> Serie TV';
            seriesSection.appendChild(seriesSectionTitle);

            const seriesGrid = document.createElement('div');
            seriesGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

            const sortedSeries = [...data.series].sort((a, b) => a.title.localeCompare(b.title));

            sortedSeries.forEach(series => {
                const seriesDiv = document.createElement('div');
                seriesDiv.className = 'subtitle-item flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800 group';
                seriesDiv.dataset.title = series.title;
                seriesDiv.dataset.id = series.imdbId;
                seriesDiv.dataset.type = 'series';
                const posterHtml = series.posterPath
                    ? `<img src="${series.posterPath}" alt="${series.title}" class="poster-image w-full h-48 object-contain group-hover:opacity-90 transition-opacity">`
                    : `<div class="poster-image w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                         <span class="text-gray-400 dark:text-gray-500 text-lg"><i class="fas fa-tv mr-2"></i>No Poster</span>
                       </div>`;

                let lastSeason = 0;
                let lastEpisode = 0;

                series.episodes.forEach(ep => {
                    if (ep.season > lastSeason) {
                        lastSeason = ep.season;
                        lastEpisode = ep.episode;
                    } else if (ep.season === lastSeason && ep.episode > lastEpisode) {
                        lastEpisode = ep.episode;
                    }
                });

                const nextEpisode = lastEpisode + 1;
                const nextSeason = lastSeason > 0 ? lastSeason : 1;

                const episodeCount = series.episodes.length;

                const addNextEpisodeBtn = `
                    <button
                        class="add-next-episode-btn bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-800/60 focus:ring-2 focus:outline-none focus:ring-indigo-300 dark:focus:ring-indigo-700 font-medium rounded-lg text-sm px-4 py-2 text-center transition-all duration-300 flex items-center justify-center gap-2 border border-indigo-200 dark:border-indigo-800/70 shadow-sm w-full"
                        data-imdbid="${series.imdbId}"
                        data-title="${series.title}"
                        data-next-season="${nextSeason}"
                        data-next-episode="${nextEpisode}">
                        <i class="fas fa-plus-circle text-indigo-600 dark:text-indigo-400"></i>
                        <span>Aggiungi SRT Ep. Successivo</span>
                        <span class="inline-flex items-center justify-center px-2 py-1 ml-1 bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-semibold rounded-md">
                            S${String(nextSeason).padStart(2, '0')}E${String(nextEpisode).padStart(2, '0')}
                        </span>
                    </button>
                `;

                seriesDiv.innerHTML = `
                    <div class="poster-container relative">
                        ${posterHtml}
                    </div>
                    <div class="flex-1 p-4">
                        <div class="flex justify-between items-start mb-1">
                            <h5 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white line-clamp-1">${series.title}</h5>
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">${series.imdbId}</span>
                        </div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                <i class="fas fa-tv mr-1"></i> Serie TV
                            </span>
                            <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                <i class="fas fa-list-ol mr-1"></i> ${episodeCount} episodi
                            </span>
                        </div>
                        <details class="subtitle-episodes-details mb-3">
                            <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                Mostra episodi
                            </summary>
                            <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2 max-h-48 overflow-y-auto pr-1 subtitle-episode-list">
                                ${series.episodes.map(ep => `
                                    <div class="episode-item p-2 rounded bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center">
                                                <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                ${ep.languages.map(lang => `
                                                    <div class="episode-lang-badge bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded text-xs font-medium text-green-800 dark:text-green-300">
                                                        ${lang}
                                                    </div>
                                                    <button data-type="series" data-imdbid="${series.imdbId}" data-season="${ep.season}" data-episode="${ep.episode}" data-lang="${lang}"
                                                        class="delete-btn ml-1 text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-700 text-sm flex items-center justify-center w-7 h-7 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all">
                                                        <i class="fas fa-trash-alt"></i>
                                                    </button>
                                                `).join('')}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                        <div class="mt-auto pt-2"></div>
                        ${addNextEpisodeBtn}
                    </div>
                `;
                seriesGrid.appendChild(seriesDiv);
            });

            seriesSection.appendChild(seriesGrid);
            subtitleListDiv.appendChild(seriesSection);
        }

        addDeleteListeners();
        addNextEpisodeListeners();
        updateFilterStats();
    }

    function handleImdbIdChange() {
        const selectedImdbId = imdbIdInput.value;
        const isSeries = contentTypeSelect.value === 'series';

        if (!isSeries || !selectedImdbId || !seriesDataCache.length) {
            return;
        }

        const seriesInfo = seriesDataCache.find(s => s.imdbId === selectedImdbId);
        if (seriesInfo && seriesInfo.episodes && seriesInfo.episodes.length > 0) {
            let lastSeason = 0;
            let lastEpisode = 0;
            seriesInfo.episodes.forEach(ep => {
                if (ep.season > lastSeason) {
                    lastSeason = ep.season;
                    lastEpisode = ep.episode;
                } else if (ep.season === lastSeason && ep.episode > lastEpisode) {
                    lastEpisode = ep.episode;
                }
            });

            const nextEpisode = lastEpisode + 1;
            const nextSeason = lastSeason > 0 ? lastSeason : 1;

            seasonInput.value = nextSeason;
            episodeInput.value = nextEpisode;
        } else {
            seasonInput.value = 1;
            episodeInput.value = 1;
        }
    }

    function addNextEpisodeListeners() {
        const nextEpisodeBtns = document.querySelectorAll('.add-next-episode-btn');
        const languageSelect = document.getElementById('language');

        nextEpisodeBtns.forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const imdbId = btn.getAttribute('data-imdbid');
                const season = btn.getAttribute('data-next-season');
                const episode = btn.getAttribute('data-next-episode');
                const title = btn.getAttribute('data-title');

                let preferredLang = 'it';
                const seriesInfo = seriesDataCache.find(s => s.imdbId === imdbId);
                if (seriesInfo && seriesInfo.episodes && seriesInfo.episodes.length > 0) {
                    const sortedEpisodes = [...seriesInfo.episodes].sort((a, b) => {
                        if (a.season !== b.season) {
                            return b.season - a.season;
                        }
                        return b.episode - a.episode;
                    });
                    const latestEpisode = sortedEpisodes[0];
                    if (latestEpisode.languages && latestEpisode.languages.length > 0) {
                        preferredLang = latestEpisode.languages[0];
                    }
                }

                contentTypeSelect.value = 'series';
                toggleSeriesFields();

                imdbIdInput.value = imdbId;
                seasonInput.value = season;
                episodeInput.value = episode;
                languageSelect.value = preferredLang;

                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });

                document.getElementById('language').focus();

                if (window.showNotification) {
                    window.showNotification(`Form compilato per ${title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`, 'success');
                }
            });
        });
    }

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        uploadStatusDiv.innerHTML = `
            <div class="bg-blue-100 text-blue-700 p-4 rounded-lg flex items-center justify-center">
                <i class="fas fa-spinner fa-spin mr-2"></i>
                Caricamento in corso...
            </div>
        `;

        const formData = new FormData(uploadForm);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            uploadStatusDiv.innerHTML = `
                <div class="bg-green-100 text-green-700 p-4 rounded-lg flex items-center justify-center">
                    <i class="fas fa-check-circle mr-2"></i>
                    Sottotitolo caricato con successo!
                </div>
            `;
            uploadForm.reset();
            document.getElementById('file-name-display').innerHTML = `<i class="fas fa-info-circle mr-2"></i> Nessun file selezionato`;
            toggleSeriesFields();
            fetchSubtitles();

            setTimeout(() => {
                uploadStatusDiv.innerHTML = '';
            }, 3000);

        } catch (error) {
            uploadStatusDiv.innerHTML = `
                <div class="bg-red-100 text-red-700 p-4 rounded-lg flex items-center justify-center">
                    <i class="fas fa-times-circle mr-2"></i>
                    Errore: ${error.message}
                </div>
            `;
        }
    });

    function addDeleteListeners() {
        subtitleListDiv.addEventListener('click', async (event) => {
            const button = event.target.closest('.delete-btn');
            if (!button) return;

            const type = button.dataset.type;
            const imdbId = button.dataset.imdbid;
            const season = button.dataset.season;
            const episode = button.dataset.episode;
            const lang = button.dataset.lang;

            let deleteId = imdbId;
            let confirmMessage = `Sei sicuro di voler eliminare il sottotitolo ${lang} per il film ${imdbId}?`;

            if (type === 'series') {
                if (!season || !episode) {
                    return;
                }
                deleteId = `${imdbId}:${season}:${episode}`;
                confirmMessage = `Sei sicuro di voler eliminare il sottotitolo ${lang} per ${imdbId} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}?`;
            }

            if (!type || !deleteId || !lang) {
                return;
            }

            if (confirm(confirmMessage)) {
                button.disabled = true;
                const originalContent = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    const response = await fetch(`/api/subtitles/${type}/${deleteId}/${lang}`, {
                        method: 'DELETE',
                    });
                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || `HTTP error! status: ${response.status}`);
                    }

                    window.showNotification('Sottotitolo eliminato con successo', 'success');
                    fetchSubtitles();

                } catch (error) {
                    window.showNotification(`Errore durante l'eliminazione: ${error.message}`, 'error');
                    button.disabled = false;
                    button.innerHTML = originalContent;
                }
            }
        });
    }

    function handleSearchInput() {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();

        if (query.length < 3) {
            searchResultsDiv.innerHTML = '';
            searchResultsDiv.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
                if (!response.ok) {
                    throw new Error(`Search API error! status: ${response.status}`);
                }
                const results = await response.json();
                displaySearchResults(results);
            } catch (error) {
                searchResultsDiv.innerHTML = '<div class="p-4 text-sm text-red-600">Errore durante la ricerca.</div>';
                searchResultsDiv.classList.remove('hidden');
            }
        }, 300);
    }

    function displaySearchResults(results) {
        searchResultsDiv.innerHTML = '';
        if (!results || results.length === 0) {
            searchResultsDiv.innerHTML = '<div class="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">Nessun risultato trovato.</div>';
            searchResultsDiv.classList.remove('hidden');
            return;
        }

        searchResultsDiv.className = 'absolute z-40 w-full mt-1 max-h-[400px] overflow-y-auto shadow-lg rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';

        results.forEach(item => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-600 last:border-b-0';
            resultDiv.dataset.imdbId = item.imdbId;
            resultDiv.dataset.type = item.type;

            const posterHtml = item.posterPath
                ? `<img src="${item.posterPath}" alt="Poster" class="w-16 h-24 rounded object-cover flex-shrink-0">`
                : '<div class="w-16 h-24 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs flex-shrink-0 dark:bg-gray-600 dark:text-gray-500">No Poster</div>';

            const typeClasses = item.type === 'series'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';

            const typeIcon = item.type === 'series'
                ? '<i class="fas fa-tv mr-1"></i>'
                : '<i class="fas fa-film mr-1"></i>';

            resultDiv.innerHTML = `
                <div class="flex gap-4">
                    ${posterHtml}
                    <div class="flex-grow">
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">${item.title}</h4>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded ${typeClasses}">
                                ${typeIcon} ${item.type === 'series' ? 'Serie TV' : 'Film'}
                            </span>
                            <span class="text-sm text-gray-500 dark:text-gray-400">${item.year}</span>
                        </div>
                        <div class="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            <i class="fas fa-film mr-1"></i> <span class="text-sm font-medium">${item.imdbId}</span>
                        </div>
                    </div>
                </div>
            `;

            resultDiv.addEventListener('click', () => {
                imdbIdInput.value = item.imdbId;
                contentTypeSelect.value = item.type;
                toggleSeriesFields();
                handleImdbIdChange();
                searchResultsDiv.classList.add('hidden');
                searchInput.value = item.title;
                document.getElementById('clear-search').style.opacity = '1';
            });

            searchResultsDiv.appendChild(resultDiv);
        });

        searchResultsDiv.classList.remove('hidden');
        if (window.uiHelpers && window.uiHelpers.positionSearchResults) {
            window.uiHelpers.positionSearchResults();
        }
    }

    fetchSubtitles();
    setupFilterFunctionality();
});

function updateFilterStats() {
    const items = document.querySelectorAll('#subtitle-list .subtitle-item');
    const resultsCountSpan = document.getElementById('results-count');

    if (items.length > 0) {
        resultsCountSpan.textContent = items.length;
    }
}

function setupFilterFunctionality() {
    const filterInput = document.getElementById('filter-subtitles');
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
        const items = document.querySelectorAll('#subtitle-list .subtitle-item');
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
            const shouldShow = title.includes(filter) || id.includes(filter) || type.includes(filter);
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
