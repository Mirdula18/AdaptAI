import pytest
import json
from app import create_app, db
from app.models import User, Notification, Certificate, ChatMessage


@pytest.fixture
def app():
    """Create test app instance."""
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.app_context():
        db.create_all()
        # Seed admin user
        admin = User(username='admin', email='admin@test.com', full_name='Admin User', role='admin')
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
    
    yield app
    
    with app.app_context():
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def admin_token(client):
    res = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
    return res.get_json()['access_token']


@pytest.fixture
def student_token(client, admin_token):
    client.post('/api/auth/register', json={
        'username': 'student1', 'email': 'student@test.com',
        'password': 'test123', 'full_name': 'Test Student'
    })
    res = client.post('/api/auth/login', json={'username': 'student1', 'password': 'test123'})
    return res.get_json()['access_token']


class TestAuth:
    def test_register(self, client):
        res = client.post('/api/auth/register', json={
            'username': 'newuser', 'email': 'new@test.com',
            'password': 'password123', 'full_name': 'New User'
        })
        assert res.status_code == 201
        assert 'access_token' in res.get_json()

    def test_register_duplicate_username(self, client):
        client.post('/api/auth/register', json={
            'username': 'dup', 'email': 'dup@test.com',
            'password': 'pass', 'full_name': 'Dup'
        })
        res = client.post('/api/auth/register', json={
            'username': 'dup', 'email': 'dup2@test.com',
            'password': 'pass', 'full_name': 'Dup2'
        })
        assert res.status_code == 409

    def test_login_success(self, client):
        res = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'access_token' in data
        assert data['user']['role'] == 'admin'

    def test_login_invalid(self, client):
        res = client.post('/api/auth/login', json={'username': 'admin', 'password': 'wrong'})
        assert res.status_code == 401

    def test_me(self, client, admin_token):
        res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200
        assert res.get_json()['username'] == 'admin'

    def test_update_profile(self, client, student_token):
        res = client.put('/api/auth/me', json={
            'bio': 'I am a test student',
            'avatar_url': 'https://example.com/avatar.png'
        }, headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['bio'] == 'I am a test student'

    def test_get_profile(self, client, student_token):
        res = client.get('/api/auth/profile', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'quiz_stats' in data
        assert 'certificates' in data

    def test_create_instructor(self, client, admin_token):
        res = client.post('/api/auth/create-instructor', json={
            'username': 'instructor1',
            'email': 'instructor@test.com',
            'full_name': 'Test Instructor'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 201
        data = res.get_json()
        assert 'temp_password' in data
        assert data['username'] == 'instructor1'

    def test_admin_reset_password(self, client, admin_token, student_token):
        # Get student user ID
        me = client.get('/api/auth/me', headers={'Authorization': f'Bearer {student_token}'})
        user_id = me.get_json()['id']
        
        res = client.post('/api/auth/admin-reset-password', json={
            'user_id': user_id,
            'new_password': 'newpass123'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200

        # Verify new password works
        login = client.post('/api/auth/login', json={'username': 'student1', 'password': 'newpass123'})
        assert login.status_code == 200


class TestCourses:
    def test_create_course(self, client, admin_token):
        res = client.post('/api/courses/', json={
            'title': 'Test Course', 'description': 'A test course', 'difficulty': 'beginner'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 201

    def test_list_courses(self, client, admin_token):
        client.post('/api/courses/', json={
            'title': 'Course 1', 'description': 'Desc', 'difficulty': 'beginner'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        res = client.get('/api/courses/')
        assert res.status_code == 200
        data = res.get_json()
        assert 'items' in data

    def test_enroll_unenroll(self, client, admin_token, student_token):
        create_res = client.post('/api/courses/', json={
            'title': 'Enroll Course', 'description': 'Test', 'difficulty': 'beginner'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        course_id = create_res.get_json()['id']

        # Enroll
        res = client.post(f'/api/courses/{course_id}/enroll',
                          headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200

        # Check enrolled status
        get_res = client.get(f'/api/courses/{course_id}',
                            headers={'Authorization': f'Bearer {student_token}'})
        assert get_res.status_code == 200
        assert get_res.get_json().get('is_enrolled') == True

        # Unenroll
        res = client.post(f'/api/courses/{course_id}/unenroll',
                          headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200


class TestUsers:
    def test_admin_can_list_users(self, client, admin_token):
        res = client.get('/api/users/', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200

    def test_student_cannot_list_users(self, client, student_token):
        res = client.get('/api/users/', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 403


class TestAdmin:
    def test_dashboard_stats(self, client, admin_token):
        res = client.get('/api/admin/dashboard', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'total_users' in data

    def test_student_cannot_access_admin(self, client, student_token):
        res = client.get('/api/admin/dashboard', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 403


class TestQuizzes:
    def test_list_quizzes(self, client, admin_token):
        res = client.get('/api/quizzes/', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200

    def test_llm_status(self, client, admin_token):
        res = client.get('/api/quizzes/llm-status', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'status' in data

    def test_pending_quizzes(self, client, admin_token):
        res = client.get('/api/quizzes/pending', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'quizzes' in data


class TestNotifications:
    def test_list_empty(self, client, student_token):
        res = client.get('/api/notifications/', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'notifications' in data

    def test_unread_count(self, client, student_token):
        res = client.get('/api/notifications/unread-count', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'count' in data
        assert data['count'] == 0

    def test_mark_all_read(self, client, student_token):
        res = client.post('/api/notifications/mark-all-read', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200


class TestCertificates:
    def test_list_empty(self, client, student_token):
        res = client.get('/api/certificates/', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'certificates' in data
        assert len(data['certificates']) == 0


class TestChatbot:
    def test_sessions_empty(self, client, student_token):
        res = client.get('/api/chatbot/sessions', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'sessions' in data

    def test_history_empty(self, client, student_token):
        res = client.get('/api/chatbot/history', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'messages' in data


class TestAnalytics:
    def test_student_progress(self, client, student_token):
        res = client.get('/api/analytics/student-progress', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'total_attempts' in data
        assert 'certificates_earned' in data
        assert 'current_streak' in data

    def test_leaderboard(self, client, admin_token):
        res = client.get('/api/analytics/leaderboard', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)

    def test_instructor_dashboard(self, client, admin_token):
        res = client.get('/api/analytics/instructor-dashboard', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'total_courses' in data
        assert 'pending_approvals' in data


class TestLicense:
    def test_license_status(self, client, admin_token):
        res = client.get('/api/license/status', headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200

    def test_activate_license(self, client, admin_token):
        res = client.post('/api/license/activate', json={'license_key': 'ACADEX-PRO-2024'},
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 200
