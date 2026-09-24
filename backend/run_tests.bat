@echo off
cd /d "c:\Users\user\Desktop\honore e commerce\muhanga-marketplace\backend"
echo.
echo === Running AUTH tests ===
node run_auth_tests.js
echo.
echo === Running CART tests ===
node run_cart_tests.js
echo.
echo === Running ORDER tests ===
node run_order_tests.js
echo.
echo === Running PAYMENT tests ===
node run_payment_tests.js
echo.
echo === All test suites complete ===
