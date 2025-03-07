/**
 * Simple program to generate a test coredump
 *
 * Compile with: gcc -o crash generate-test-coredump.c
 * Run with: ./crash
 * 
 * The program will intentionally cause a segmentation fault to generate a coredump
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main() {
    printf("This program will intentionally crash to generate a coredump...\n");
    
    // Make sure core dumps are enabled
    printf("Before running, make sure core dumps are enabled:\n");
    printf("  $ ulimit -c unlimited\n");
    printf("  $ sysctl -w kernel.core_pattern=\"|/usr/lib/systemd/systemd-coredump %%P %%u %%g %%s %%t %%c %%h\"\n\n");
    
    printf("Generating segmentation fault in 3 seconds...\n");
    fflush(stdout);
    sleep(3);
    
    // Intentionally cause a segmentation fault
    char *ptr = NULL;
    strcpy(ptr, "This will crash");  // This will trigger a segmentation fault
    
    // This will never be reached
    return 0;
}
