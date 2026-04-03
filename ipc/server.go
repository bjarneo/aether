package ipc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Dispatcher handles IPC commands by the running application.
type Dispatcher interface {
	HandleIPC(req Request) Response
}

// Server listens on a Unix domain socket for IPC commands.
type Server struct {
	listener net.Listener
	sockPath string
	disp     Dispatcher
	done     chan struct{}
	wg       sync.WaitGroup
}

// NewServer creates and starts an IPC server on the given socket path.
func NewServer(sockPath string, disp Dispatcher) (*Server, error) {
	if err := cleanStaleSocket(sockPath); err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(sockPath), 0700); err != nil {
		return nil, fmt.Errorf("ipc: mkdir: %w", err)
	}

	ln, err := net.Listen("unix", sockPath)
	if err != nil {
		return nil, fmt.Errorf("ipc: listen: %w", err)
	}

	if err := os.Chmod(sockPath, 0600); err != nil {
		ln.Close()
		os.Remove(sockPath)
		return nil, fmt.Errorf("ipc: chmod: %w", err)
	}

	pidPath := sockPath + ".pid"
	if err := os.WriteFile(pidPath, []byte(strconv.Itoa(os.Getpid())), 0600); err != nil {
		ln.Close()
		os.Remove(sockPath)
		return nil, fmt.Errorf("ipc: write pid: %w", err)
	}

	s := &Server{
		listener: ln,
		sockPath: sockPath,
		disp:     disp,
		done:     make(chan struct{}),
	}
	s.wg.Add(1)
	go s.acceptLoop()

	log.Printf("IPC server listening on %s", sockPath)
	return s, nil
}

// Close shuts down the IPC server and cleans up socket files.
func (s *Server) Close() error {
	close(s.done)
	err := s.listener.Close()
	s.wg.Wait()
	os.Remove(s.sockPath)
	os.Remove(s.sockPath + ".pid")
	return err
}

func (s *Server) acceptLoop() {
	defer s.wg.Done()
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			select {
			case <-s.done:
				return
			default:
				time.Sleep(100 * time.Millisecond)
				continue
			}
		}
		s.wg.Add(1)
		go s.handleConn(conn)
	}
}

func (s *Server) handleConn(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	conn.SetDeadline(time.Now().Add(30 * time.Second))
	scanner := bufio.NewScanner(conn)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var req Request
		if err := json.Unmarshal(line, &req); err != nil {
			writeResponse(conn, Response{OK: false, Error: "invalid JSON: " + err.Error()})
			continue
		}

		resp := s.disp.HandleIPC(req)
		writeResponse(conn, resp)
	}
}

func writeResponse(conn net.Conn, resp Response) {
	data, err := json.Marshal(resp)
	if err != nil {
		data = []byte(`{"ok":false,"error":"marshal error"}`)
	}
	data = append(data, '\n')
	conn.Write(data)
}

// cleanStaleSocket removes a leftover socket from a crashed instance.
func cleanStaleSocket(sockPath string) error {
	pidPath := sockPath + ".pid"
	pidData, err := os.ReadFile(pidPath)
	if err != nil {
		// No PID file — remove orphan socket if it exists
		os.Remove(sockPath)
		return nil
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(pidData)))
	if err != nil {
		os.Remove(pidPath)
		os.Remove(sockPath)
		return nil
	}

	proc, err := os.FindProcess(pid)
	if err != nil {
		os.Remove(pidPath)
		os.Remove(sockPath)
		return nil
	}

	if err := proc.Signal(syscall.Signal(0)); err != nil {
		// Process is dead — clean up stale files
		os.Remove(pidPath)
		os.Remove(sockPath)
		return nil
	}

	// Process is still running
	return fmt.Errorf("ipc: aether is already running (pid %d)", pid)
}
