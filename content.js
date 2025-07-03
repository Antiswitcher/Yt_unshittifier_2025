// YouTube Recommendation Cleaner - Content Script
(function() {
    'use strict';

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentVideo = null;
    const DRAG_THRESHOLD = 30; // Minimum pixels to register as drag

    // Selectors for YouTube elements (may need updates if YouTube changes their HTML)
    const SELECTORS = {
        videoThumbnail: 'ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer',
        menuButton: 'button[aria-label*="More actions"], button[aria-label*="Action menu"]',
        notInterestedButton: 'tp-yt-paper-listbox #items ytd-menu-service-item-renderer:first-child',
        watchedCheckbox: 'tp-yt-paper-checkbox[aria-label*="watched"]',
        dislikeCheckbox: 'tp-yt-paper-checkbox[aria-label*="don\'t like"], tp-yt-paper-checkbox[aria-label*="not interested"]'
    };

    function findVideoContainer(element) {
        // Find the closest video container
        while (element && element !== document.body) {
            if (element.matches && element.matches(SELECTORS.videoThumbnail)) {
                return element;
            }
            element = element.parentElement;
        }
        return null;
    }

    function findMenuButton(videoContainer) {
        return videoContainer.querySelector(SELECTORS.menuButton);
    }

    function waitForElement(selector, timeout = 3000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    async function processNotInterested(dragDirection) {
        if (!currentVideo) return;

        try {
            // Find and click the menu button
            const menuButton = findMenuButton(currentVideo);
            if (!menuButton) {
                console.log('Menu button not found');
                return;
            }

            menuButton.click();

            // Wait for menu to appear and click "Not interested"
            const notInterestedButton = await waitForElement(SELECTORS.notInterestedButton, 2000);
            notInterestedButton.click();

            // Wait for the feedback form to appear
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check appropriate boxes based on drag direction
            if (dragDirection.includes('left')) {
                // User dragged left - they've watched the video
                const watchedBox = document.querySelector(SELECTORS.watchedCheckbox);
                if (watchedBox && !watchedBox.checked) {
                    watchedBox.click();
                }
            }

            if (dragDirection.includes('down')) {
                // User dragged down - they don't like the video
                const dislikeBox = document.querySelector(SELECTORS.dislikeCheckbox);
                if (dislikeBox && !dislikeBox.checked) {
                    dislikeBox.click();
                }
            }

            // Submit the form (usually there's a submit button)
            await new Promise(resolve => setTimeout(resolve, 300));
            const submitButton = document.querySelector('tp-yt-paper-button[aria-label*="Submit"], button[aria-label*="Submit"]');
            if (submitButton) {
                submitButton.click();
            }

            console.log(`Marked video as not interested: ${dragDirection}`);

        } catch (error) {
            console.error('Error processing not interested:', error);
        }
    }

    function handleMouseDown(e) {
        // Only handle left mouse button
        if (e.button !== 0) return;

        const videoContainer = findVideoContainer(e.target);
        if (!videoContainer) return;

        // Don't interfere with normal clicks on links or buttons
        if (e.target.closest('a, button, input')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        currentVideo = videoContainer;

        // Add visual feedback
        videoContainer.style.opacity = '0.7';
        
        e.preventDefault();
    }

    function handleMouseMove(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Provide visual feedback for drag direction
        if (currentVideo) {
            let cursor = 'grabbing';
            if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
                if (deltaX < -DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) {
                    cursor = 'w-resize'; // Left drag - watched
                    currentVideo.style.borderLeft = '4px solid #4CAF50';
                } else if (deltaY > DRAG_THRESHOLD && Math.abs(deltaX) < DRAG_THRESHOLD) {
                    cursor = 's-resize'; // Down drag - don't like
                    currentVideo.style.borderBottom = '4px solid #f44336';
                } else if (deltaX < -DRAG_THRESHOLD && deltaY > DRAG_THRESHOLD) {
                    cursor = 'sw-resize'; // Both
                    currentVideo.style.borderLeft = '4px solid #4CAF50';
                    currentVideo.style.borderBottom = '4px solid #f44336';
                }
            }
            document.body.style.cursor = cursor;
        }
    }

    function handleMouseUp(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Reset visual feedback
        if (currentVideo) {
            currentVideo.style.opacity = '';
            currentVideo.style.borderLeft = '';
            currentVideo.style.borderBottom = '';
        }
        document.body.style.cursor = '';

        // Determine drag direction and process
        let dragDirection = [];
        if (deltaX < -DRAG_THRESHOLD) dragDirection.push('left');
        if (deltaY > DRAG_THRESHOLD) dragDirection.push('down');

        if (dragDirection.length > 0) {
            processNotInterested(dragDirection);
        }

        // Reset state
        isDragging = false;
        currentVideo = null;
    }

    // Add event listeners
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);

    // Prevent text selection during drag
    document.addEventListener('selectstart', (e) => {
        if (isDragging) e.preventDefault();
    }, true);

    console.log('YouTube Recommendation Cleaner loaded');
})();
