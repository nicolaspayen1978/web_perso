 document.addEventListener("DOMContentLoaded", function () {

          // Select menu elements
          const menuIcon = document.querySelector(".menu-icon");
          const navMenu = document.querySelector(".nav-menu");

          if (!menuIcon || !navMenu) {
              console.error("Menu elements not found.");
              return;
          }

          // Enable toggle on click (for desktop)
          menuIcon.addEventListener("click", function (event) {
              event.stopPropagation();
              navMenu.classList.toggle("visible");
          });

          // Ensure iPhone touch events work properly
          menuIcon.addEventListener("touchstart", function (event) {
              event.stopPropagation();
              navMenu.classList.toggle("visible");
          });

          // Hide menu when clicking outside (for both desktop & mobile)
          document.addEventListener("click", function (event) {
              if (!menuIcon.contains(event.target) && !navMenu.contains(event.target)) {
                  navMenu.classList.remove("visible");
              }
          });

          // Hide menu when clicking outside (for iPhone touch)
          document.addEventListener("touchstart", function (event) {
              if (!menuIcon.contains(event.target) && !navMenu.contains(event.target)) {
                  navMenu.classList.remove("visible");
              }
          });

          // Prevent menu from closing when touching inside (iPhone fix)
          navMenu.addEventListener("touchstart", function (event) {
              event.stopPropagation();
          });

          // Hide menu when clicking a menu item
          navMenu.addEventListener("click", function (event) {
              if (event.target.tagName === "A") {
                  navMenu.classList.remove("visible");
              }
          });
      });

      let lastScrollTop = 0;
      let scrollThreshold = 50; // Adjust sensitivity (higher = less flickering)
      let header = document.querySelector("header");
      let isHidden = false;

      window.addEventListener("scroll", function () {
          let currentScroll = window.scrollY || document.documentElement.scrollTop;
          const navMenu = document.querySelector(".nav-menu");

          if (Math.abs(currentScroll - lastScrollTop) < scrollThreshold) {
              return; // Ignore small scrolls to prevent flickering
          }

          if (currentScroll > lastScrollTop && currentScroll > 50) {
              // Scrolling down past 50px - hide header
              if (!isHidden) {
                  header.style.top = "-100px"; 
                  header.style.opacity = "0";
                  isHidden = true;
              }
          } else {
              // Scrolling up - show header
              if (isHidden) {
                  header.style.top = "0";
                  header.style.opacity = "1";
                  isHidden = false;
                  //hide icon-menu menu if displayed
                  navMenu.classList.remove("visible");
              }
          }

          lastScrollTop = currentScroll;
      });