from src.app import saludo


def test_saludo():
    assert saludo() == "hola"
